"""
User Acceptance Testing (UAT) framework for UITrace
"""

import asyncio
import json
import time
import traceback
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, field
import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Add the server directory to Python path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.core.database import get_session
from src.models.script import Script
from src.models.project import Project
from src.models.user import User
from src.services.script_service import ScriptService
from src.services.browser_automation import BrowserAutomationService, BrowserAutomationConfig
from src.services.network_resilience import NetworkResilienceService, NetworkResilienceConfig
from src.services.execution_resilience import ExecutionResilienceService, ExecutionResilienceConfig
from src.services.performance_monitoring import PerformanceMonitoringService
from tests.test_data_generator import DataGenerator


@dataclass
class UATTestCase:
    """User acceptance test case"""
    id: str
    name: str
    description: str
    category: str
    priority: str  # high, medium, low
    prerequisites: List[str]
    test_steps: List[Dict[str, Any]]
    expected_results: List[str]
    success_criteria: List[str]
    cleanup_steps: List[str] = field(default_factory=list)


@dataclass
class UATTestResult:
    """User acceptance test result"""
    test_case_id: str
    test_case_name: str
    status: str  # passed, failed, skipped, blocked
    start_time: datetime
    end_time: Optional[datetime] = None
    duration: float = 0.0
    actual_results: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    screenshots: List[str] = field(default_factory=list)
    notes: str = ""


class UserAcceptanceTestFramework:
    """Framework for conducting user acceptance tests"""

    def __init__(self):
        self.test_cases: List[UATTestCase] = []
        self.results: List[UATTestResult] = []
        self.test_data_generator = DataGenerator(seed=42)
        self.script_service = ScriptService()
        self.performance_monitor = PerformanceMonitoringService()

        # Initialize services
        self._initialize_services()

    def _initialize_services(self):
        """Initialize required services for UAT"""
        # Browser automation service
        browser_config = BrowserAutomationConfig(
            selenium_hub_url="local",
            headless=True,
            browser_timeout=30,
            window_size=(1280, 720)
        )
        self.browser_service = BrowserAutomationService(browser_config)

        # Network resilience service
        network_config = NetworkResilienceConfig(
            max_retries=3,
            base_delay=1.0,
            max_delay=10.0,
            timeout=30.0
        )
        self.network_service = NetworkResilienceService(network_config)

        # Execution resilience service
        execution_config = ExecutionResilienceConfig(
            max_execution_retries=3,
            execution_timeout=120.0,
            step_timeout=30.0,
            recovery_delay=2.0,
            enable_cdp_monitoring=False
        )
        self.execution_service = ExecutionResilienceService(execution_config)

    def load_test_cases(self, test_case_file: str):
        """Load test cases from JSON file"""
        try:
            with open(test_case_file, 'r') as f:
                test_data = json.load(f)

            for tc_data in test_data.get('test_cases', []):
                test_case = UATTestCase(
                    id=tc_data['id'],
                    name=tc_data['name'],
                    description=tc_data['description'],
                    category=tc_data['category'],
                    priority=tc_data['priority'],
                    prerequisites=tc_data.get('prerequisites', []),
                    test_steps=tc_data['test_steps'],
                    expected_results=tc_data['expected_results'],
                    success_criteria=tc_data['success_criteria'],
                    cleanup_steps=tc_data.get('cleanup_steps', [])
                )
                self.test_cases.append(test_case)

            print(f"✅ Loaded {len(self.test_cases)} test cases from {test_case_file}")

        except Exception as e:
            print(f"❌ Error loading test cases: {e}")
            raise

    async def run_test_case(self, test_case: UATTestCase, session: AsyncSession) -> UATTestResult:
        """Run a single test case"""
        print(f"\n🧪 Running UAT: {test_case.name}")
        print(f"   Description: {test_case.description}")
        print(f"   Priority: {test_case.priority}")

        result = UATTestResult(
            test_case_id=test_case.id,
            test_case_name=test_case.name,
            status="skipped",  # Default status
            start_time=datetime.now()
        )

        try:
            # Check prerequisites
            print(f"   Checking prerequisites...")
            prerequisites_met = await self._check_prerequisites(test_case.prerequisites, session)
            if not prerequisites_met:
                result.status = "blocked"
                result.notes = "Prerequisites not met"
                print(f"   ⚠️  Blocked: Prerequisites not met")
                return result

            # Execute test steps
            print(f"   Executing {len(test_case.test_steps)} test steps...")
            step_results = await self._execute_test_steps(test_case, session)

            # Validate results
            print(f"   Validating results...")
            validation_passed = self._validate_results(test_case, step_results)

            # Determine test status
            result.status = "passed" if validation_passed else "failed"
            result.actual_results = step_results

            # Record performance metrics
            result.end_time = datetime.now()
            result.duration = (result.end_time - result.start_time).total_seconds()

            print(f"   ✅ Test completed in {result.duration:.2f}s - Status: {result.status.upper()}")

        except Exception as e:
            result.status = "failed"
            result.errors.append(str(e))
            result.end_time = datetime.now()
            result.duration = (result.end_time - result.start_time).total_seconds()
            print(f"   ❌ Test failed: {e}")
            traceback.print_exc()

        finally:
            # Cleanup
            if test_case.cleanup_steps:
                print(f"   Running cleanup steps...")
                await self._execute_cleanup_steps(test_case.cleanup_steps, session)

        return result

    async def _check_prerequisites(self, prerequisites: List[str], session: AsyncSession) -> bool:
        """Check if test prerequisites are met"""
        try:
            for prereq in prerequisites:
                if prereq == "database_connection":
                    # Test database connection
                    await session.execute(select(1))
                elif prereq == "browser_service_available":
                    # Test browser service
                    if not self.browser_service:
                        return False
                elif prereq == "network_service_available":
                    # Test network service
                    if not self.network_service:
                        return False
                elif prereq == "test_data_available":
                    # Verify test data generation works
                    test_users = self.test_data_generator.generate_test_users(1)
                    if not test_users:
                        return False
                else:
                    print(f"   ⚠️  Unknown prerequisite: {prereq}")

            return True

        except Exception as e:
            print(f"   ❌ Prerequisite check failed: {e}")
            return False

    async def _execute_test_steps(self, test_case: UATTestCase, session: AsyncSession) -> List[str]:
        """Execute test steps and return results"""
        results = []

        for i, step in enumerate(test_case.test_steps, 1):
            step_name = step.get("name", f"Step {i}")
            print(f"     {i}. {step_name}")

            try:
                action_type = step.get("action")

                if action_type == "create_script":
                    result = await self._create_script_test(step, session)
                elif action_type == "validate_script":
                    result = await self._validate_script_test(step, session)
                elif action_type == "execute_script":
                    result = await self._execute_script_test(step, session)
                elif action_type == "browser_action":
                    result = await self._browser_action_test(step, session)
                elif action_type == "network_request":
                    result = await self._network_request_test(step, session)
                elif action_type == "performance_check":
                    result = await self._performance_check_test(step, session)
                else:
                    result = f"Unknown action type: {action_type}"

                results.append(result)
                print(f"        ✅ {result}")

            except Exception as e:
                error_result = f"Failed: {str(e)}"
                results.append(error_result)
                print(f"        ❌ {error_result}")

        return results

    async def _create_script_test(self, step: Dict[str, Any], session: AsyncSession) -> str:
        """Test script creation functionality"""
        script_content = step.get("script_content", {})

        # Validate script content
        is_valid = await self.script_service.validate_script_content(json.dumps(script_content))
        if not is_valid:
            raise ValueError("Script content validation failed")

        # Compress script
        script_json = json.dumps(script_content)
        compressed = await self.script_service.compress_content(script_json)

        return f"Script created and compressed: {len(script_json)} → {len(compressed)} bytes"

    async def _validate_script_test(self, step: Dict[str, Any], session: AsyncSession) -> str:
        """Test script validation functionality"""
        script_content = step.get("script_content", {})

        # Validate script content
        is_valid = await self.script_service.validate_script_content(json.dumps(script_content))

        return f"Script validation: {'PASSED' if is_valid else 'FAILED'}"

    async def _execute_script_test(self, step: Dict[str, Any], session: AsyncSession) -> str:
        """Test script execution functionality"""
        script_content = step.get("script_content", {})
        execution_id = step.get("execution_id", f"uat_execution_{int(time.time())}")

        # Create execution context
        context = await self.execution_service.create_resilient_execution(
            execution_id=execution_id,
            script_id="uat_test_script",
            browser_type="chrome",
            enable_cdp=False
        )

        if not context:
            raise ValueError("Failed to create execution context")

        # Execute script with resilience
        success = await self.execution_service.execute_script_with_resilience(
            execution_id=execution_id,
            session=session,
            script_content=script_content
        )

        # Cleanup
        await self.execution_service.cleanup_execution(execution_id)

        return f"Script execution: {'SUCCESS' if success else 'FAILED'}"

    async def _browser_action_test(self, step: Dict[str, Any], session: AsyncSession) -> str:
        """Test browser action functionality"""
        action = step.get("browser_action", "navigate")
        url = step.get("url", "https://httpbin.org/html")

        # Create browser session
        session_id = f"uat_browser_session_{int(time.time())}"
        browser_session = await self.browser_service.create_session(
            session_id=session_id,
            browser_type="chrome"
        )

        try:
            if action == "navigate":
                success = await browser_session.navigate_to(url)
                result = f"Navigation to {url}: {'SUCCESS' if success else 'FAILED'}"
            elif action == "screenshot":
                await browser_session.navigate_to(url)
                screenshot = await browser_session.take_screenshot()
                result = f"Screenshot captured: {len(screenshot) if isinstance(screenshot, str) else 'saved'}"
            elif action == "javascript":
                await browser_session.navigate_to(url)
                js_result = await browser_session.execute_script("return document.title;")
                result = f"JavaScript execution result: {js_result}"
            else:
                result = f"Unknown browser action: {action}"

        finally:
            # Cleanup browser session
            await self.browser_service.close_session(session_id)

        return result

    async def _network_request_test(self, step: Dict[str, Any], session: AsyncSession) -> str:
        """Test network request functionality"""
        method = step.get("method", "GET")
        url = step.get("url", "https://httpbin.org/get")

        # Make request with resilience
        response = await self.network_service.make_request_with_resilience(method, url)

        return f"Network request {method} {url}: Status {response.status}"

    async def _performance_check_test(self, step: Dict[str, Any], session: AsyncSession) -> str:
        """Test performance monitoring functionality"""
        # Get current metrics
        current_metrics = self.performance_monitor.get_current_metrics()

        # Check if metrics are available
        if not current_metrics:
            return "No performance metrics available"

        # Check performance thresholds
        cpu_threshold = step.get("cpu_threshold", 80.0)
        memory_threshold = step.get("memory_threshold", 80.0)

        cpu_usage = current_metrics.get("system", {}).get("cpu_usage", 0)
        memory_usage = current_metrics.get("system", {}).get("memory_usage", 0)

        if cpu_usage > cpu_threshold:
            return f"CPU usage {cpu_usage:.1f}% exceeds threshold {cpu_threshold}%"

        if memory_usage > memory_threshold:
            return f"Memory usage {memory_usage:.1f}% exceeds threshold {memory_threshold}%"

        return f"Performance check passed - CPU: {cpu_usage:.1f}%, Memory: {memory_usage:.1f}%"

    def _validate_results(self, test_case: UATTestCase, actual_results: List[str]) -> bool:
        """Validate test results against expected criteria"""
        if len(test_case.expected_results) != len(actual_results):
            return False

        # Simple string matching validation
        for expected, actual in zip(test_case.expected_results, actual_results):
            if expected not in actual and "SUCCESS" not in actual and "PASSED" not in actual:
                return False

        return True

    async def _execute_cleanup_steps(self, cleanup_steps: List[str], session: AsyncSession):
        """Execute cleanup steps"""
        for step in cleanup_steps:
            try:
                if step == "close_browser_sessions":
                    # Close all browser sessions
                    pass  # Implementation depends on browser service
                elif step == "cleanup_test_data":
                    # Cleanup test data
                    pass  # Implementation depends on data cleanup logic
                else:
                    print(f"     Unknown cleanup step: {step}")
            except Exception as e:
                print(f"     Cleanup step failed: {step} - {e}")

    async def run_all_tests(self, session: AsyncSession, filter_category: Optional[str] = None) -> List[UATTestResult]:
        """Run all test cases or filtered by category"""
        print(f"\n🚀 Starting User Acceptance Testing")
        print(f"   Total test cases: {len(self.test_cases)}")

        if filter_category:
            test_cases = [tc for tc in self.test_cases if tc.category == filter_category]
            print(f"   Filtered by category '{filter_category}': {len(test_cases)} tests")
        else:
            test_cases = self.test_cases

        # Sort by priority
        priority_order = {"high": 0, "medium": 1, "low": 2}
        test_cases.sort(key=lambda tc: priority_order.get(tc.priority, 3))

        # Start performance monitoring
        await self.performance_monitor.start_monitoring(interval=10)

        try:
            # Run tests
            for test_case in test_cases:
                result = await self.run_test_case(test_case, session)
                self.results.append(result)

                # Stop on critical failure
                if result.status == "failed" and test_case.priority == "high":
                    print(f"\n🛑 Stopping test execution due to critical failure")
                    break

            # Generate report
            await self.generate_uat_report()

        finally:
            # Stop performance monitoring
            await self.performance_monitor.stop_monitoring()

        return self.results

    async def generate_uat_report(self):
        """Generate comprehensive UAT report"""
        print(f"\n📊 Generating UAT Report")

        # Calculate statistics
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r.status == "passed")
        failed_tests = sum(1 for r in self.results if r.status == "failed")
        skipped_tests = sum(1 for r in self.results if r.status == "skipped")
        blocked_tests = sum(1 for r in self.results if r.status == "blocked")

        # Calculate duration
        if self.results:
            start_times = [r.start_time for r in self.results]
            end_times = [r.end_time for r in self.results if r.end_time]
            total_duration = (max(end_times) - min(start_times)).total_seconds() if end_times else 0
        else:
            total_duration = 0

        # Performance metrics summary
        perf_summary = self.performance_monitor.get_metrics_summary(hours=24)

        # Generate report
        report = {
            "summary": {
                "total_tests": total_tests,
                "passed_tests": passed_tests,
                "failed_tests": failed_tests,
                "skipped_tests": skipped_tests,
                "blocked_tests": blocked_tests,
                "success_rate": (passed_tests / total_tests * 100) if total_tests > 0 else 0,
                "total_duration": total_duration,
                "timestamp": datetime.now().isoformat()
            },
            "performance_metrics": perf_summary,
            "detailed_results": [
                {
                    "test_case_id": r.test_case_id,
                    "test_case_name": r.test_case_name,
                    "status": r.status,
                    "duration": r.duration,
                    "errors": r.errors,
                    "notes": r.notes
                }
                for r in self.results
            ]
        }

        # Save report
        report_file = f"tests/uat_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)

        # Print summary
        print(f"\n" + "="*60)
        print(f"🏁 USER ACCEPTANCE TESTING COMPLETED")
        print(f"="*60)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Skipped: {skipped_tests} ⏭️")
        print(f"Blocked: {blocked_tests} 🚫")
        print(f"Success Rate: {report['summary']['success_rate']:.1f}%")
        print(f"Total Duration: {total_duration:.2f}s")
        print(f"Report saved to: {report_file}")
        print(f"="*60)

        return report


# Default UAT test cases
DEFAULT_UAT_TEST_CASES = {
    "test_cases": [
        {
            "id": "UAT_001",
            "name": "Script Creation and Validation",
            "description": "Test creating and validating a test automation script",
            "category": "script_management",
            "priority": "high",
            "prerequisites": ["database_connection", "test_data_available"],
            "test_steps": [
                {
                    "name": "Create test script",
                    "action": "create_script",
                    "script_content": {
                        "steps": [
                            {
                                "id": "step_1",
                                "action": "navigate",
                                "type": "navigate",
                                "url": "https://httpbin.org/html",
                                "order_index": 0,
                                "description": "Navigate to test page"
                            }
                        ],
                        "variables": {"base_url": "https://httpbin.org"}
                    }
                },
                {
                    "name": "Validate script content",
                    "action": "validate_script",
                    "script_content": {
                        "steps": [
                            {
                                "id": "step_1",
                                "action": "navigate",
                                "type": "navigate",
                                "url": "https://httpbin.org/html",
                                "order_index": 0,
                                "description": "Navigate to test page"
                            }
                        ],
                        "variables": {"base_url": "https://httpbin.org"}
                    }
                }
            ],
            "expected_results": [
                "Script created and compressed",
                "Script validation: PASSED"
            ],
            "success_criteria": [
                "Script is successfully created",
                "Script validation passes",
                "Content compression works correctly"
            ]
        },
        {
            "id": "UAT_002",
            "name": "Browser Navigation and Screenshot",
            "description": "Test browser navigation and screenshot capture",
            "category": "browser_automation",
            "priority": "high",
            "prerequisites": ["browser_service_available"],
            "test_steps": [
                {
                    "name": "Navigate to test page",
                    "action": "browser_action",
                    "browser_action": "navigate",
                    "url": "https://httpbin.org/html"
                },
                {
                    "name": "Take screenshot",
                    "action": "browser_action",
                    "browser_action": "screenshot"
                }
            ],
            "expected_results": [
                "Navigation to https://httpbin.org/html: SUCCESS",
                "Screenshot captured"
            ],
            "success_criteria": [
                "Browser navigation completes successfully",
                "Screenshot is captured without errors"
            ]
        },
        {
            "id": "UAT_003",
            "name": "Network Resilience Testing",
            "description": "Test network resilience with retry mechanisms",
            "category": "network_resilience",
            "priority": "medium",
            "prerequisites": ["network_service_available"],
            "test_steps": [
                {
                    "name": "Make HTTP request",
                    "action": "network_request",
                    "method": "GET",
                    "url": "https://httpbin.org/get"
                }
            ],
            "expected_results": [
                "Network request GET https://httpbin.org/get: Status 200"
            ],
            "success_criteria": [
                "Network request succeeds",
                "Response status is 200"
            ]
        },
        {
            "id": "UAT_004",
            "name": "Script Execution with Resilience",
            "description": "Test script execution with error recovery",
            "category": "execution_resilience",
            "priority": "high",
            "prerequisites": ["browser_service_available", "execution_service_available"],
            "test_steps": [
                {
                    "name": "Execute test script",
                    "action": "execute_script",
                    "execution_id": "uat_resilience_test",
                    "script_content": {
                        "steps": [
                            {
                                "id": "step_1",
                                "action": "navigate",
                                "type": "navigate",
                                "url": "https://httpbin.org/html",
                                "order_index": 0,
                                "description": "Navigate to test page"
                            },
                            {
                                "id": "step_2",
                                "action": "wait",
                                "type": "wait",
                                "duration": 1,
                                "order_index": 1,
                                "description": "Wait for page load"
                            }
                        ],
                        "variables": {"wait_time": 1}
                    }
                }
            ],
            "expected_results": [
                "Script execution: SUCCESS"
            ],
            "success_criteria": [
                "Script execution completes successfully",
                "All steps are executed without errors"
            ]
        },
        {
            "id": "UAT_005",
            "name": "Performance Monitoring Validation",
            "description": "Test performance monitoring and metrics collection",
            "category": "performance_monitoring",
            "priority": "medium",
            "prerequisites": ["performance_monitoring_available"],
            "test_steps": [
                {
                    "name": "Check system performance",
                    "action": "performance_check",
                    "cpu_threshold": 90.0,
                    "memory_threshold": 90.0
                }
            ],
            "expected_results": [
                "Performance check passed"
            ],
            "success_criteria": [
                "Performance metrics are available",
                "System resources are within acceptable limits"
            ]
        }
    ]
}


async def run_user_acceptance_tests():
    """Run user acceptance tests"""
    print("🚀 Starting User Acceptance Testing for UITrace")

    # Create UAT framework
    uat_framework = UserAcceptanceTestFramework()

    # Create default test cases file if it doesn't exist
    test_cases_file = "tests/uat_test_cases.json"
    if not Path(test_cases_file).exists():
        with open(test_cases_file, 'w') as f:
            json.dump(DEFAULT_UAT_TEST_CASES, f, indent=2)
        print(f"✅ Created default UAT test cases: {test_cases_file}")

    # Load test cases
    uat_framework.load_test_cases(test_cases_file)

    # Run tests with mock database session
    class MockSession:
        async def execute(self, query):
            return None
        async def get(self, model, id):
            return None
        async def commit(self):
            pass

    mock_session = MockSession()
    results = await uat_framework.run_all_tests(mock_session)

    return results


if __name__ == "__main__":
    asyncio.run(run_user_acceptance_tests())