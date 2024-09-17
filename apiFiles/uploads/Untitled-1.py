dbutils.widgets.text("param1", "default_value", "Parameter 1")
dbutils.widgets.text("param2", "default_value", "Parameter 2")

# Access the parameter values
param1 = dbutils.widgets.get("param1")
param2 = dbutils.widgets.get("param2")

print(f"Parameter 1: {param1}")
print(f"Parameter 2: {param2}")
