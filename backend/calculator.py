import json
import boto3
import time
import os

class AWSCostEstimator:
    def __init__(self):
        region = os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')
        self.pricing = boto3.client('pricing', region_name='us-east-1')
        self.dynamodb = boto3.resource('dynamodb', region_name=region)
        self.table = self.dynamodb.Table('AWSPricingCache')
        self.ttl = 86400

    def get_svc_attributes(self, service_code):
        """Discovers what questions (attributes) to ask the user for ANY service."""
        response = self.pricing.describe_services(ServiceCode=service_code, FormatVersion='aws_v1')
        return response['Services'][0]['AttributeNames']

    def get_svc_attribute_values(self, service_code, attr_name):
        """Discovers the valid options for a specific dropdown."""
        values = []
        paginator = self.pricing.get_paginator('get_attribute_values')
        for page in paginator.paginate(ServiceCode=service_code, AttributeName=attr_name):
            for val in page['AttributeValues']:
                values.append(val['Value'])
        return sorted(values)

    def calculate_estimate(self, service_code, selections, quantity=1):
        """
        Dynamically calculates the price and applies monthly logic 
        based on the 'Unit' AWS returns.
        """
        # 1. Fetch Price (Uses the dynamic logic we built before)
        result = self.get_svc_price(service_code, selections)
        if "error" in result: return result

        price = result['price']
        unit = result['unit']

        # 2. Dynamic Monthly Normalization
        # We don't hardcode 'EC2'. We look at the 'Unit' string.
        if unit == "Hrs":
            # Compute services (EC2, RDS) usually return 'Hrs'
            monthly = price * 730 * quantity
        elif unit == "GB-Mo":
            # Storage services (S3, EBS) usually return 'GB-Mo'
            monthly = price * quantity
        elif unit == "Quantity" or unit == "Requests":
            monthly = price * quantity
        else:
            # Fallback for unpredictable units
            monthly = price * quantity

        return {
            "unit_price": price,
            "unit_type": unit,
            "monthly_estimate": round(monthly, 2)
        } 
    def get_all_svc_codes(self):
        """
        DYNAMIC ONLY: Fetches all valid AWS Service Codes.
        No hardcoded fallbacks to ensure data integrity.
        """
        try:
            services = []
            # Use the Pricing Paginator to handle the 100+ AWS services
            paginator = self.pricing.get_paginator('describe_services')
            
            for page in paginator.paginate(FormatVersion='aws_v1'):
                for svc in page['Services']:
                    services.append(svc['ServiceCode'])
            
            # If the list is empty, we return an empty list so the UI knows
            # the API call succeeded but returned no data (or handle as error)
            return sorted(services)
            
        except Exception as e:
            # We log the error for CloudWatch/Logs
            print(f"CRITICAL: Failed to fetch dynamic service list: {e}")
            # Returning an empty list triggers the UI's 'No services found' state
            return []

    def get_svc_price(self, service_code, selections):
        """
        The Core Search Engine. 
        It transforms UI selections into AWS Pricing Filters.
        """
        filters = []
        for key, value in selections.items():
            if value: # Only filter by non-empty selections
                filters.append({'Type': 'TERM_MATCH', 'Field': key, 'Value': value})

        try:
            response = self.pricing.get_products(
                ServiceCode=service_code,
                Filters=filters,
                FormatVersion='aws_v1',
                MaxResults=1
            )
            
            if not response['PriceList']:
                return {"error": "No product found matching these criteria"}

            # Parse the insane nested JSON AWS returns
            price_data = json.loads(response['PriceList'][0])
            on_demand = price_data['terms']['OnDemand']
            id1 = list(on_demand.keys())[0]
            id2 = list(on_demand[id1]['priceDimensions'].keys())[0]
            
            dimension = on_demand[id1]['priceDimensions'][id2]
            
            return {
                "price": float(dimension['pricePerUnit']['USD']),
                "unit": dimension['unit']
            }
        except Exception as e:
            return {"error": str(e)}