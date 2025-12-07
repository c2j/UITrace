"""
Test data generator for E2E tests
"""

import json
import csv
import random
import string
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import uuid


@dataclass
class TestUserData:
    username: str
    email: str
    first_name: str
    last_name: str
    age: int
    country: str
    city: str
    phone: str
    address: str
    registration_date: str


@dataclass
class TestProductData:
    name: str
    description: str
    price: float
    category: str
    sku: str
    stock_quantity: int
    rating: float
    manufacturer: str


@dataclass
class TestOrderData:
    order_id: str
    user_email: str
    product_skus: List[str]
    total_amount: float
    order_date: str
    status: str
    shipping_address: str


class DataGenerator:
    """Generate realistic test data for E2E testing"""

    def __init__(self, seed: Optional[int] = None):
        if seed is not None:
            random.seed(seed)

        self.countries = [
            "United States", "United Kingdom", "Canada", "Australia", "Germany",
            "France", "Japan", "Brazil", "India", "China", "Mexico", "Italy",
            "Spain", "Netherlands", "Sweden", "South Korea", "Russia", "Argentina"
        ]

        self.cities = [
            "New York", "London", "Toronto", "Sydney", "Berlin", "Paris", "Tokyo",
            "São Paulo", "Mumbai", "Beijing", "Mexico City", "Rome", "Madrid",
            "Amsterdam", "Stockholm", "Seoul", "Moscow", "Buenos Aires"
        ]

        self.first_names = [
            "John", "Jane", "Michael", "Sarah", "David", "Emma", "Robert", "Lisa",
            "James", "Maria", "William", "Jennifer", "Richard", "Patricia", "Charles", "Linda"
        ]

        self.last_names = [
            "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
            "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas"
        ]

        self.product_categories = [
            "Electronics", "Clothing", "Books", "Home & Garden", "Sports",
            "Automotive", "Toys", "Beauty", "Food", "Jewelry", "Health", "Office"
        ]

        self.product_adjectives = [
            "Premium", "Professional", "Deluxe", "Advanced", "Compact", "Portable",
            "Wireless", "Smart", "Eco-Friendly", "Ergonomic", "Durable", "Stylish"
        ]

        self.product_names = [
            "Laptop", "Smartphone", "Headphones", "Camera", "Watch", "Tablet",
            "Speaker", "Monitor", "Keyboard", "Mouse", "Printer", "Scanner"
        ]

        self.manufacturers = [
            "TechCorp", "Global Industries", "Quality Products Inc", "Innovation Labs",
            "Elite Manufacturing", "Precision Works", "Superior Brands", "Prime Components"
        ]

        self.order_statuses = [
            "pending", "processing", "shipped", "delivered", "cancelled", "refunded"
        ]

    def generate_email(self, first_name: str, last_name: str) -> str:
        """Generate email address"""
        providers = ["gmail.com", "yahoo.com", "outlook.com", "company.com", "test.com"]
        formats = [
            f"{first_name.lower()}.{last_name.lower()}",
            f"{first_name.lower()[0]}{last_name.lower()}",
            f"{first_name.lower()}{random.randint(1, 999)}",
            f"{last_name.lower()}{first_name.lower()[0]}",
        ]

        local_part = random.choice(formats)
        domain = random.choice(providers)
        return f"{local_part}@{domain}"

    def generate_phone(self, country: str) -> str:
        """Generate phone number based on country"""
        if "United States" in country or "Canada" in country:
            area_code = random.randint(200, 999)
            exchange = random.randint(200, 999)
            number = random.randint(1000, 9999)
            return f"+1 ({area_code}) {exchange}-{number}"
        elif "United Kingdom" in country:
            return f"+44 {random.randint(7000, 7999)} {random.randint(100000, 999999)}"
        elif "Germany" in country:
            return f"+49 {random.randint(151, 179)} {random.randint(1000000, 9999999)}"
        else:
            return f"+{random.randint(1, 99)} {random.randint(100000000, 999999999)}"

    def generate_address(self, country: str, city: str) -> str:
        """Generate realistic address"""
        street_names = [
            "Main Street", "Oak Avenue", "Elm Drive", "Park Road", "First Street",
            "Second Avenue", "Maple Lane", "Pine Street", "Washington Drive", "Lincoln Road"
        ]

        street_number = random.randint(1, 9999)
        street_name = random.choice(street_names)
        postal_code = f"{random.randint(10000, 99999)}"

        return f"{street_number} {street_name}, {city}, {postal_code}, {country}"

    def generate_test_users(self, count: int) -> List[TestUserData]:
        """Generate test users"""
        users = []

        for _ in range(count):
            first_name = random.choice(self.first_names)
            last_name = random.choice(self.last_names)
            country = random.choice(self.countries)
            city = random.choice(self.cities)

            user = TestUserData(
                username=f"{first_name.lower()}{last_name.lower()}{random.randint(1, 999)}",
                email=self.generate_email(first_name, last_name),
                first_name=first_name,
                last_name=last_name,
                age=random.randint(18, 70),
                country=country,
                city=city,
                phone=self.generate_phone(country),
                address=self.generate_address(country, city),
                registration_date=self.generate_random_date(365)  # Within last year
            )
            users.append(user)

        return users

    def generate_test_products(self, count: int) -> List[TestProductData]:
        """Generate test products"""
        products = []

        for _ in range(count):
            category = random.choice(self.product_categories)
            adjective = random.choice(self.product_adjectives)
            name = random.choice(self.product_names)
            manufacturer = random.choice(self.manufacturers)

            product = TestProductData(
                name=f"{adjective} {name}",
                description=f"High-quality {name.lower()} with advanced features and modern design",
                price=round(random.uniform(10.0, 2000.0), 2),
                category=category,
                sku=f"SKU{random.randint(10000, 99999)}",
                stock_quantity=random.randint(0, 1000),
                rating=round(random.uniform(3.0, 5.0), 1),
                manufacturer=manufacturer
            )
            products.append(product)

        return products

    def generate_test_orders(self, users: List[TestUserData], products: List[TestProductData], count: int) -> List[TestOrderData]:
        """Generate test orders"""
        orders = []

        for i in range(count):
            user = random.choice(users)
            order_products = random.sample(products, random.randint(1, 5))
            total_amount = sum(product.price for product in order_products)

            order = TestOrderData(
                order_id=f"ORD{datetime.now().year}{random.randint(100000, 999999)}",
                user_email=user.email,
                product_skus=[product.sku for product in order_products],
                total_amount=round(total_amount, 2),
                order_date=self.generate_random_date(30),  # Within last 30 days
                status=random.choice(self.order_statuses),
                shipping_address=user.address
            )
            orders.append(order)

        return orders

    def generate_random_date(self, days_back: int) -> str:
        """Generate random date within specified days back"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        random_date = start_date + timedelta(
            seconds=random.randint(0, int((end_date - start_date).total_seconds()))
        )
        return random_date.isoformat()

    def generate_json_data(self, data_type: str, count: int) -> Dict[str, Any]:
        """Generate JSON data for specified type"""
        if data_type == "users":
            users = self.generate_test_users(count)
            return {
                "data_type": "users",
                "count": len(users),
                "generated_at": datetime.now().isoformat(),
                "data": [self.user_to_dict(user) for user in users]
            }
        elif data_type == "products":
            products = self.generate_test_products(count)
            return {
                "data_type": "products",
                "count": len(products),
                "generated_at": datetime.now().isoformat(),
                "data": [self.product_to_dict(product) for product in products]
            }
        elif data_type == "orders":
            users = self.generate_test_users(10)  # Generate users first
            products = self.generate_test_products(20)  # Generate products
            orders = self.generate_test_orders(users, products, count)
            return {
                "data_type": "orders",
                "count": len(orders),
                "generated_at": datetime.now().isoformat(),
                "data": [self.order_to_dict(order) for order in orders]
            }
        else:
            raise ValueError(f"Unknown data type: {data_type}")

    def generate_csv_data(self, data_type: str, count: int) -> str:
        """Generate CSV data for specified type"""
        if data_type == "users":
            users = self.generate_test_users(count)
            output = []
            output.append("username,email,first_name,last_name,age,country,city,phone,address,registration_date")
            for user in users:
                output.append(
                    f"{user.username},{user.email},{user.first_name},{user.last_name},"
                    f"{user.age},{user.country},{user.city},{user.phone},{user.address},{user.registration_date}"
                )
            return "\n".join(output)
        elif data_type == "products":
            products = self.generate_test_products(count)
            output = []
            output.append("name,description,price,category,sku,stock_quantity,rating,manufacturer")
            for product in products:
                output.append(
                    f"{product.name},{product.description},{product.price},{product.category},"
                    f"{product.sku},{product.stock_quantity},{product.rating},{product.manufacturer}"
                )
            return "\n".join(output)
        else:
            raise ValueError(f"CSV generation not supported for: {data_type}")

    def user_to_dict(self, user: TestUserData) -> Dict[str, Any]:
        """Convert TestUser to dictionary"""
        return {
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "age": user.age,
            "country": user.country,
            "city": user.city,
            "phone": user.phone,
            "address": user.address,
            "registration_date": user.registration_date
        }

    def product_to_dict(self, product: TestProductData) -> Dict[str, Any]:
        """Convert TestProduct to dictionary"""
        return {
            "name": product.name,
            "description": product.description,
            "price": product.price,
            "category": product.category,
            "sku": product.sku,
            "stock_quantity": product.stock_quantity,
            "rating": product.rating,
            "manufacturer": product.manufacturer
        }

    def order_to_dict(self, order: TestOrderData) -> Dict[str, Any]:
        """Convert TestOrder to dictionary"""
        return {
            "order_id": order.order_id,
            "user_email": order.user_email,
            "product_skus": order.product_skus,
            "total_amount": order.total_amount,
            "order_date": order.order_date,
            "status": order.status,
            "shipping_address": order.shipping_address
        }

    def generate_script_test_data(self) -> Dict[str, Any]:
        """Generate test data specifically for script testing"""
        return {
            "test_urls": [
                "https://httpbin.org/html",
                "https://httpbin.org/forms/post",
                "https://httpbin.org/delay/1",
                "https://example.com",
                "https://www.google.com"
            ],
            "test_selectors": [
                {"type": "css", "selector": "h1", "description": "Heading element"},
                {"type": "css", "selector": "input[type='text']", "description": "Text input"},
                {"type": "css", "selector": "button", "description": "Button element"},
                {"type": "id", "selector": "search-input", "description": "Search input field"},
                {"type": "class", "selector": "btn-primary", "description": "Primary button"}
            ],
            "test_texts": [
                "Hello World",
                "Test Automation",
                "UITrace Platform",
                "End-to-End Testing",
                "Selenium WebDriver"
            ],
            "test_delays": [1, 2, 3, 5, 10]  # seconds
        }

    def generate_browser_test_scenarios(self) -> List[Dict[str, Any]]:
        """Generate browser test scenarios"""
        return [
            {
                "name": "Simple Navigation Test",
                "steps": [
                    {"action": "navigate", "url": "https://httpbin.org/html"},
                    {"action": "wait", "duration": 2},
                    {"action": "screenshot"}
                ]
            },
            {
                "name": "Form Interaction Test",
                "steps": [
                    {"action": "navigate", "url": "https://httpbin.org/forms/post"},
                    {"action": "input", "selector": "input[name='custname']", "text": "John Doe"},
                    {"action": "input", "selector": "input[name='custtel']", "text": "123-456-7890"},
                    {"action": "click", "selector": "button[type='submit']"},
                    {"action": "wait", "duration": 3}
                ]
            },
            {
                "name": "Element Finding Test",
                "steps": [
                    {"action": "navigate", "url": "https://example.com"},
                    {"action": "find", "selector": "h1", "selector_type": "tag"},
                    {"action": "find", "selector": "p", "selector_type": "tag"},
                    {"action": "screenshot"}
                ]
            }
        ]

    def save_test_data(self, data: Dict[str, Any], filename: str, format: str = "json"):
        """Save test data to file"""
        if format == "json":
            with open(f"{filename}.json", "w") as f:
                json.dump(data, f, indent=2)
        elif format == "csv" and "data_type" in data:
            data_type = data["data_type"]
            if data_type == "users":
                self.save_users_csv(data["data"], filename)
            elif data_type == "products":
                self.save_products_csv(data["data"], filename)

    def save_users_csv(self, users_data: List[Dict[str, Any]], filename: str):
        """Save users data as CSV"""
        with open(f"{filename}.csv", "w", newline="") as f:
            if users_data:
                writer = csv.DictWriter(f, fieldnames=users_data[0].keys())
                writer.writeheader()
                writer.writerows(users_data)

    def save_products_csv(self, products_data: List[Dict[str, Any]], filename: str):
        """Save products data as CSV"""
        with open(f"{filename}.csv", "w", newline="") as f:
            if products_data:
                writer = csv.DictWriter(f, fieldnames=products_data[0].keys())
                writer.writeheader()
                writer.writerows(products_data)


def main():
    """Generate test data for E2E tests"""
    print("🚀 Generating Test Data for E2E Tests")
    print("=" * 50)

    generator = DataGenerator(seed=42)  # Fixed seed for reproducible results

    # Generate users
    print("\n👥 Generating test users...")
    users_data = generator.generate_json_data("users", 10)
    generator.save_test_data(users_data, "test_users", "json")
    generator.save_test_data(users_data, "test_users", "csv")
    print(f"✅ Generated {users_data['count']} test users")

    # Generate products
    print("\n📦 Generating test products...")
    products_data = generator.generate_json_data("products", 20)
    generator.save_test_data(products_data, "test_products", "json")
    generator.save_test_data(products_data, "test_products", "csv")
    print(f"✅ Generated {products_data['count']} test products")

    # Generate orders
    print("\n📋 Generating test orders...")
    orders_data = generator.generate_json_data("orders", 15)
    generator.save_test_data(orders_data, "test_orders", "json")
    print(f"✅ Generated {orders_data['count']} test orders")

    # Generate script test data
    print("\n📝 Generating script test data...")
    script_data = generator.generate_script_test_data()
    generator.save_test_data(script_data, "script_test_data", "json")
    print("✅ Generated script test data")

    # Generate browser test scenarios
    print("\n🌐 Generating browser test scenarios...")
    scenarios = generator.generate_browser_test_scenarios()
    generator.save_test_data({"scenarios": scenarios}, "browser_test_scenarios", "json")
    print(f"✅ Generated {len(scenarios)} browser test scenarios")

    print("\n🎉 Test data generation completed!")
    print("\nGenerated files:")
    print("  - test_users.json/csv")
    print("  - test_products.json/csv")
    print("  - test_orders.json")
    print("  - script_test_data.json")
    print("  - browser_test_scenarios.json")


if __name__ == "__main__":
    main()