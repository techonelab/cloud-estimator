import json
import boto3
import time
import os

class AWSCostEstimator:
    def __init__(self):
        region = os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')
        # Pricing API is only available in us-east-1 or ap-south-1
        self.pricing = boto3.client('pricing', region_name='us-east-1')
        self.dynamodb = boto3.resource('dynamodb', region_name=region)
        self.table = self.dynamodb.Table('AWSPricingCache')
        self.ttl = 86400

    def get_all_svc_codes(self):
        """
        DYNAMIC ONLY: Fetches all valid AWS Service Codes.
        No hardcoded fallbacks to ensure data integrity.
        """
        try:
            services = []
            paginator = self.pricing.get_paginator('describe_services')
            for page in paginator.paginate(FormatVersion='aws_v1'):
                for svc in page['Services']:
                    services.append(svc['ServiceCode'])
            return sorted(services)
        except Exception as e:
            print(f"CRITICAL: Failed to fetch dynamic service list: {e}")
            return []

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

    def get_svc_price(self, service_code, selections):
        """
        The Core Search Engine. 
        Prioritizes core price drivers to avoid over-filtering/contradictions.
        """
        filters = []
        
        if 'location' in selections and selections['location']:
            filters.append({'Type': 'TERM_MATCH', 'Field': 'location', 'Value': selections['location']})

        # hard to filter due to nth number of services - bottleneck
        core_drivers = [
            'instanceType', 'operatingSystem', 'databaseEngine', 'storageClass', 
            'volumeType', 'deploymentOption', 'cacheNodeType', 'tenancy', 
            'licenseModel', 'databaseEdition', 'engineCode'
        ]

        for field in core_drivers:
            if field in selections and selections[field]:
                filters.append({'Type': 'TERM_MATCH', 'Field': field, 'Value': selections[field]})

        if len(filters) <= 1:
            for key, value in selections.items():
                if value and key not in ['location', 'quantity']:
                    filters.append({'Type': 'TERM_MATCH', 'Field': key, 'Value': value})

        try:
            response = self.pricing.get_products(
                ServiceCode=service_code,
                Filters=filters,
                FormatVersion='aws_v1',
                MaxResults=1
            )
            
            if not response['PriceList']:
                return {"error": f"No product found for {service_code}. Try a simpler configuration."}

            price_data = json.loads(response['PriceList'][0])
            on_demand = price_data['terms']['OnDemand']
            
            # Navigate to the standard on-demand offer
            offer_id = list(on_demand.keys())[0]
            dimensions = on_demand[offer_id]['priceDimensions']
            
            # Tiered Pricing: Get the first tier (usually starting at 0 usage)
            first_dimension_id = sorted(dimensions.keys())[0]
            dimension = dimensions[first_dimension_id]
            
            return {
                "price": float(dimension['pricePerUnit']['USD']),
                "unit": dimension['unit']
            }
        except Exception as e:
            return {"error": str(e)}

    def calculate_estimate(self, service_code, selections, quantity=1):
        """
        Calculates monthly estimate by normalizing unit types (Hrs, GB-Mo, etc.)
        """
        result = self.get_svc_price(service_code, selections)
        if "error" in result: 
            return {"monthly_estimate": 0, "error": result['error']}

        price = result['price']
        unit = result['unit'].lower()

        # Normalization logic based on Unit buckets
        if any(u in unit for u in ["hr", "hour", "hrs"]):
            # Compute/DB (730 hours per month)
            monthly = price * 730 * quantity
        elif any(u in unit for u in ["gb-mo", "gb-month", "gb month"]):
            # Storage
            monthly = price * quantity
        elif any(u in unit for u in ["request", "quantity", "unit", "reqs"]):
            # Serverless/Requests
            monthly = price * quantity
        elif "provisioned" in unit:
            # Throughput (IOPS/WCU/RCU)
            monthly = price * 730 * quantity
        else:
            # Standard multiplier
            monthly = price * quantity

        return {
            "unit_price": price,
            "unit_type": result['unit'],
            "monthly_estimate": round(monthly, 2)
        }