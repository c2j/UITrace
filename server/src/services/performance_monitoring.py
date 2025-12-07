"""
Performance monitoring and metrics collection service for UITrace
"""

import asyncio
import time
import json
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import psutil
import prometheus_client
from prometheus_client import Counter, Histogram, Gauge, Info
import structlog
from collections import defaultdict, deque

logger = structlog.get_logger(__name__)


@dataclass
class PerformanceMetrics:
    """Performance metrics data structure"""
    timestamp: datetime
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    network_io: Dict[str, int]
    process_count: int
    thread_count: int
    response_times: List[float] = field(default_factory=list)
    error_count: int = 0
    request_count: int = 0


@dataclass
class BrowserMetrics:
    """Browser-specific performance metrics"""
    session_id: str
    browser_type: str
    start_time: datetime
    navigation_count: int = 0
    screenshot_count: int = 0
    javascript_executions: int = 0
    element_interactions: int = 0
    memory_usage: float = 0.0
    cpu_usage: float = 0.0
    total_duration: float = 0.0


@dataclass
class ScriptExecutionMetrics:
    """Script execution performance metrics"""
    execution_id: str
    script_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    step_count: int = 0
    success_count: int = 0
    failure_count: int = 0
    retry_count: int = 0
    total_duration: float = 0.0
    step_durations: List[float] = field(default_factory=list)
    network_requests: int = 0
    network_errors: int = 0


class PerformanceMonitoringService:
    """Performance monitoring service for collecting and analyzing system metrics"""

    def __init__(self):
        self.metrics_history: deque = deque(maxlen=1000)
        self.browser_metrics: Dict[str, BrowserMetrics] = {}
        self.execution_metrics: Dict[str, ScriptExecutionMetrics] = {}
        self.response_times: deque = deque(maxlen=1000)
        self.error_counts: Dict[str, int] = defaultdict(int)
        self.request_counts: Dict[str, int] = defaultdict(int)

        # Prometheus metrics
        self._setup_prometheus_metrics()

        # Monitoring state
        self.is_monitoring = False
        self.monitoring_task: Optional[asyncio.Task] = None

        logger.info("Performance monitoring service initialized")

    def _setup_prometheus_metrics(self):
        """Initialize Prometheus metrics"""
        # System metrics
        self.cpu_usage_gauge = Gauge('uitrace_cpu_usage_percent', 'CPU usage percentage')
        self.memory_usage_gauge = Gauge('uitrace_memory_usage_percent', 'Memory usage percentage')
        self.disk_usage_gauge = Gauge('uitrace_disk_usage_percent', 'Disk usage percentage')
        self.process_count_gauge = Gauge('uitrace_process_count', 'Number of processes')
        self.thread_count_gauge = Gauge('uitrace_thread_count', 'Number of threads')

        # Application metrics
        self.request_count = Counter('uitrace_requests_total', 'Total number of requests', ['method', 'endpoint'])
        self.response_time_histogram = Histogram('uitrace_response_time_seconds', 'Response time in seconds', ['method', 'endpoint'])
        self.error_count = Counter('uitrace_errors_total', 'Total number of errors', ['type', 'endpoint'])

        # Browser metrics
        self.browser_sessions_gauge = Gauge('uitrace_browser_sessions_active', 'Number of active browser sessions')
        self.browser_navigation_count = Counter('uitrace_browser_navigation_total', 'Total browser navigation count')
        self.browser_screenshot_count = Counter('uitrace_browser_screenshot_total', 'Total screenshot count')
        self.browser_js_execution_count = Counter('uitrace_browser_js_execution_total', 'Total JavaScript executions')

        # Script execution metrics
        self.script_executions_count = Counter('uitrace_script_executions_total', 'Total script executions', ['status'])
        self.script_execution_duration = Histogram('uitrace_script_execution_duration_seconds', 'Script execution duration')
        self.script_step_duration = Histogram('uitrace_script_step_duration_seconds', 'Individual script step duration')
        self.script_retry_count = Counter('uitrace_script_retries_total', 'Total script retry attempts')

        # Network metrics
        self.network_requests_count = Counter('uitrace_network_requests_total', 'Total network requests', ['status'])
        self.network_request_duration = Histogram('uitrace_network_request_duration_seconds', 'Network request duration')

        logger.info("Prometheus metrics initialized")

    async def start_monitoring(self, interval: int = 30):
        """Start system monitoring"""
        if self.is_monitoring:
            logger.warning("Monitoring already running")
            return

        self.is_monitoring = True
        self.monitoring_task = asyncio.create_task(self._monitoring_loop(interval))
        logger.info(f"Performance monitoring started with {interval}s interval")

    async def stop_monitoring(self):
        """Stop system monitoring"""
        if not self.is_monitoring:
            return

        self.is_monitoring = False
        if self.monitoring_task:
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass

        logger.info("Performance monitoring stopped")

    async def _monitoring_loop(self, interval: int):
        """Main monitoring loop"""
        try:
            while self.is_monitoring:
                try:
                    await self._collect_system_metrics()
                    await self._update_prometheus_metrics()
                    await asyncio.sleep(interval)
                except Exception as e:
                    logger.error(f"Error in monitoring loop: {e}")
                    await asyncio.sleep(interval)
        except asyncio.CancelledError:
            logger.info("Monitoring loop cancelled")

    async def _collect_system_metrics(self):
        """Collect current system metrics"""
        try:
            # CPU usage
            cpu_usage = psutil.cpu_percent(interval=1)

            # Memory usage
            memory = psutil.virtual_memory()
            memory_usage = memory.percent

            # Disk usage
            disk = psutil.disk_usage('/')
            disk_usage = (disk.used / disk.total) * 100

            # Network I/O
            network_io = psutil.net_io_counters()
            network_stats = {
                'bytes_sent': network_io.bytes_sent,
                'bytes_recv': network_io.bytes_recv,
                'packets_sent': network_io.packets_sent,
                'packets_recv': network_io.packets_recv
            }

            # Process and thread counts
            process_count = len(psutil.pids())
            thread_count = sum(p.num_threads() for p in psutil.process_iter(['num_threads']) if p.info)

            # Create metrics object
            metrics = PerformanceMetrics(
                timestamp=datetime.now(),
                cpu_usage=cpu_usage,
                memory_usage=memory_usage,
                disk_usage=disk_usage,
                network_io=network_stats,
                process_count=process_count,
                thread_count=thread_count,
                response_times=list(self.response_times),
                error_count=sum(self.error_counts.values()),
                request_count=sum(self.request_counts.values())
            )

            # Store in history
            self.metrics_history.append(metrics)

            logger.debug(f"System metrics collected: CPU={cpu_usage}%, Memory={memory_usage}%, Disk={disk_usage}%")

        except Exception as e:
            logger.error(f"Error collecting system metrics: {e}")

    async def _update_prometheus_metrics(self):
        """Update Prometheus metrics with latest values"""
        try:
            if not self.metrics_history:
                return

            latest_metrics = self.metrics_history[-1]

            # Update system metrics
            self.cpu_usage_gauge.set(latest_metrics.cpu_usage)
            self.memory_usage_gauge.set(latest_metrics.memory_usage)
            self.disk_usage_gauge.set(latest_metrics.disk_usage)
            self.process_count_gauge.set(latest_metrics.process_count)
            self.thread_count_gauge.set(latest_metrics.thread_count)

            # Update browser metrics
            self.browser_sessions_gauge.set(len(self.browser_metrics))

        except Exception as e:
            logger.error(f"Error updating Prometheus metrics: {e}")

    def record_request(self, method: str, endpoint: str, response_time: float, status_code: int):
        """Record HTTP request metrics"""
        try:
            # Update request count
            self.request_counts[f"{method}:{endpoint}"] += 1
            self.request_count.labels(method=method, endpoint=endpoint).inc()

            # Record response time
            self.response_times.append(response_time)
            self.response_time_histogram.labels(method=method, endpoint=endpoint).observe(response_time)

            # Record error if status code indicates failure
            if status_code >= 400:
                error_type = f"HTTP_{status_code}"
                self.error_counts[error_type] += 1
                self.error_count.labels(type=error_type, endpoint=endpoint).inc()

            logger.debug(f"Request recorded: {method} {endpoint} - {response_time}s - {status_code}")

        except Exception as e:
            logger.error(f"Error recording request metrics: {e}")

    def start_browser_session(self, session_id: str, browser_type: str):
        """Start tracking browser session metrics"""
        try:
            metrics = BrowserMetrics(
                session_id=session_id,
                browser_type=browser_type,
                start_time=datetime.now()
            )
            self.browser_metrics[session_id] = metrics
            logger.info(f"Browser session metrics started: {session_id} ({browser_type})")

        except Exception as e:
            logger.error(f"Error starting browser session metrics: {e}")

    def record_browser_action(self, session_id: str, action_type: str, duration: float = 0.0):
        """Record browser action metrics"""
        try:
            if session_id not in self.browser_metrics:
                return

            metrics = self.browser_metrics[session_id]

            if action_type == "navigation":
                metrics.navigation_count += 1
                self.browser_navigation_count.inc()
            elif action_type == "screenshot":
                metrics.screenshot_count += 1
                self.browser_screenshot_count.inc()
            elif action_type == "javascript":
                metrics.javascript_executions += 1
                self.browser_js_execution_count.inc()
            elif action_type == "element_interaction":
                metrics.element_interactions += 1

            if duration > 0:
                metrics.total_duration += duration

            logger.debug(f"Browser action recorded: {session_id} - {action_type} - {duration}s")

        except Exception as e:
            logger.error(f"Error recording browser action metrics: {e}")

    def end_browser_session(self, session_id: str):
        """End browser session and record final metrics"""
        try:
            if session_id not in self.browser_metrics:
                return

            metrics = self.browser_metrics[session_id]
            metrics.total_duration = (datetime.now() - metrics.start_time).total_seconds()

            # Log session summary
            logger.info(f"Browser session ended: {session_id} - Duration: {metrics.total_duration}s, "
                       f"Navigations: {metrics.navigation_count}, Screenshots: {metrics.screenshot_count}, "
                       f"JS Executions: {metrics.javascript_executions}")

            # Remove from active tracking
            del self.browser_metrics[session_id]

        except Exception as e:
            logger.error(f"Error ending browser session metrics: {e}")

    def start_script_execution(self, execution_id: str, script_id: str):
        """Start tracking script execution metrics"""
        try:
            metrics = ScriptExecutionMetrics(
                execution_id=execution_id,
                script_id=script_id,
                start_time=datetime.now()
            )
            self.execution_metrics[execution_id] = metrics
            logger.info(f"Script execution metrics started: {execution_id} ({script_id})")

        except Exception as e:
            logger.error(f"Error starting script execution metrics: {e}")

    def record_script_step(self, execution_id: str, step_duration: float, success: bool, retry_count: int = 0):
        """Record script step execution metrics"""
        try:
            if execution_id not in self.execution_metrics:
                return

            metrics = self.execution_metrics[execution_id]
            metrics.step_count += 1
            metrics.step_durations.append(step_duration)
            metrics.retry_count += retry_count

            if success:
                metrics.success_count += 1
            else:
                metrics.failure_count += 1

            # Record step duration
            self.script_step_duration.observe(step_duration)

            logger.debug(f"Script step recorded: {execution_id} - Duration: {step_duration}s, Success: {success}")

        except Exception as e:
            logger.error(f"Error recording script step metrics: {e}")

    def record_network_request(self, execution_id: str, success: bool, duration: float):
        """Record network request metrics"""
        try:
            if execution_id not in self.execution_metrics:
                return

            metrics = self.execution_metrics[execution_id]
            metrics.network_requests += 1

            if success:
                self.network_requests_count.labels(status="success").inc()
            else:
                metrics.network_errors += 1
                self.network_requests_count.labels(status="error").inc()

            self.network_request_duration.observe(duration)

            logger.debug(f"Network request recorded: {execution_id} - Success: {success} - {duration}s")

        except Exception as e:
            logger.error(f"Error recording network request metrics: {e}")

    def end_script_execution(self, execution_id: str, success: bool):
        """End script execution and record final metrics"""
        try:
            if execution_id not in self.execution_metrics:
                return

            metrics = self.execution_metrics[execution_id]
            metrics.end_time = datetime.now()
            metrics.total_duration = (metrics.end_time - metrics.start_time).total_seconds()

            # Record execution metrics
            status = "success" if success else "failure"
            self.script_executions_count.labels(status=status).inc()
            self.script_execution_duration.observe(metrics.total_duration)

            # Log execution summary
            logger.info(f"Script execution ended: {execution_id} - Duration: {metrics.total_duration}s, "
                       f"Steps: {metrics.step_count}, Success: {metrics.success_count}, "
                       f"Failures: {metrics.failure_count}, Retries: {metrics.retry_count}")

            # Remove from active tracking
            del self.execution_metrics[execution_id]

        except Exception as e:
            logger.error(f"Error ending script execution metrics: {e}")

    def get_current_metrics(self) -> Dict[str, Any]:
        """Get current system and application metrics"""
        try:
            if not self.metrics_history:
                return {}

            latest_metrics = self.metrics_history[-1]

            return {
                "system": {
                    "cpu_usage": latest_metrics.cpu_usage,
                    "memory_usage": latest_metrics.memory_usage,
                    "disk_usage": latest_metrics.disk_usage,
                    "process_count": latest_metrics.process_count,
                    "thread_count": latest_metrics.thread_count,
                    "network_io": latest_metrics.network_io
                },
                "application": {
                    "request_count": latest_metrics.request_count,
                    "error_count": latest_metrics.error_count,
                    "response_times": list(latest_metrics.response_times),
                    "active_browser_sessions": len(self.browser_metrics),
                    "active_script_executions": len(self.execution_metrics)
                },
                "timestamp": latest_metrics.timestamp.isoformat()
            }

        except Exception as e:
            logger.error(f"Error getting current metrics: {e}")
            return {}

    def get_metrics_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get metrics summary for the specified time period"""
        try:
            cutoff_time = datetime.now() - timedelta(hours=hours)
            relevant_metrics = [m for m in self.metrics_history if m.timestamp >= cutoff_time]

            if not relevant_metrics:
                return {}

            # Calculate averages
            avg_cpu = sum(m.cpu_usage for m in relevant_metrics) / len(relevant_metrics)
            avg_memory = sum(m.memory_usage for m in relevant_metrics) / len(relevant_metrics)
            avg_disk = sum(m.disk_usage for m in relevant_metrics) / len(relevant_metrics)

            # Calculate response time statistics
            all_response_times = []
            for m in relevant_metrics:
                all_response_times.extend(m.response_times)

            response_time_stats = {}
            if all_response_times:
                response_time_stats = {
                    "avg": sum(all_response_times) / len(all_response_times),
                    "min": min(all_response_times),
                    "max": max(all_response_times),
                    "count": len(all_response_times)
                }

            # Error rate
            total_requests = sum(m.request_count for m in relevant_metrics)
            total_errors = sum(m.error_count for m in relevant_metrics)
            error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0

            return {
                "period_hours": hours,
                "system": {
                    "avg_cpu_usage": avg_cpu,
                    "avg_memory_usage": avg_memory,
                    "avg_disk_usage": avg_disk,
                    "max_cpu_usage": max(m.cpu_usage for m in relevant_metrics),
                    "max_memory_usage": max(m.memory_usage for m in relevant_metrics),
                    "max_disk_usage": max(m.disk_usage for m in relevant_metrics)
                },
                "application": {
                    "total_requests": total_requests,
                    "total_errors": total_errors,
                    "error_rate_percent": error_rate,
                    "response_time_stats": response_time_stats
                },
                "sample_count": len(relevant_metrics),
                "generated_at": datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Error getting metrics summary: {e}")
            return {}

    def export_metrics(self, format: str = "json") -> str:
        """Export metrics data in specified format"""
        try:
            summary = self.get_metrics_summary()
            current = self.get_current_metrics()

            data = {
                "summary": summary,
                "current": current,
                "browser_sessions": len(self.browser_metrics),
                "script_executions": len(self.execution_metrics),
                "exported_at": datetime.now().isoformat()
            }

            if format.lower() == "json":
                return json.dumps(data, indent=2, default=str)
            else:
                # Simple text format
                lines = [
                    "UITrace Performance Metrics Report",
                    "=" * 40,
                    f"Generated: {data['exported_at']}",
                    "",
                    "System Metrics:",
                    f"  CPU Usage: {current.get('system', {}).get('cpu_usage', 0):.1f}%",
                    f"  Memory Usage: {current.get('system', {}).get('memory_usage', 0):.1f}%",
                    f"  Disk Usage: {current.get('system', {}).get('disk_usage', 0):.1f}%",
                    "",
                    "Application Metrics:",
                    f"  Active Browser Sessions: {len(self.browser_metrics)}",
                    f"  Active Script Executions: {len(self.execution_metrics)}",
                    f"  Total Requests: {summary.get('application', {}).get('total_requests', 0)}",
                    f"  Error Rate: {summary.get('application', {}).get('error_rate_percent', 0):.2f}%"
                ]
                return "\n".join(lines)

        except Exception as e:
            logger.error(f"Error exporting metrics: {e}")
            return f"Error exporting metrics: {e}"


# Global performance monitoring instance
_performance_monitor: Optional[PerformanceMonitoringService] = None


def get_performance_monitor() -> PerformanceMonitoringService:
    """Get the global performance monitoring service instance"""
    global _performance_monitor
    if _performance_monitor is None:
        _performance_monitor = PerformanceMonitoringService()
    return _performance_monitor


def init_performance_monitoring():
    """Initialize the global performance monitoring service"""
    global _performance_monitor
    _performance_monitor = PerformanceMonitoringService()
    logger.info("Performance monitoring initialized globally")


def cleanup_performance_monitoring():
    """Cleanup the global performance monitoring service"""
    global _performance_monitor
    if _performance_monitor:
        asyncio.create_task(_performance_monitor.stop_monitoring())
        _performance_monitor = None
        logger.info("Performance monitoring cleaned up")