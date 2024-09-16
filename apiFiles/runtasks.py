import json
import requests
import time

# Databricks API credentials
DATABRICKS_HOST = 'https://adb-2391317195324727.7.azuredatabricks.net'  # Replace with your Databricks host
DATABRICKS_TOKEN = 'dapi2ba83a009e697fc9940656df705a7098-3'  # Replace with your Databricks token
CLUSTER_ID = '0913-052228-mn4cbjcl'  # Replace with your cluster ID
with open('/home/vesh/uploads/workflow_with_files.json') as f:
    data = json.load(f)

headers = {"Authorization": f"Bearer {DATABRICKS_TOKEN}"}
def get_task_key(task_name):
    return task_name.replace(" ", "_").lower()

def create_and_run_databricks_job():
    create_job_url = f"{DATABRICKS_HOST}/api/2.1/jobs/create"
    
    job_payload = {
        "name": data["workflow_name"],
        "tasks": [],
        "max_concurrent_runs": 1  # Ensure tasks run sequentially
    }
    
    task_key_map = {}
    for task in data["tasks"]:
        task_key = get_task_key(task["task_name"])
        task_key_map[task["task_id"]] = task_key
        # print(task_key)

        job_task = {
            "task_key": task_key,  # Use derived task key
            "notebook_task": {
                "notebook_path": f"/Workspace/Users/hackathon_ai10@centific.com/POD_K2/clean_data_notebook",  # Replace with the actual notebook path
                "base_parameters": {}  # Can add parameters if needed
            },
            "existing_cluster_id": CLUSTER_ID  # Use the existing cluster
        }
        if task["dependencies"]:
            job_task["depends_on"] = [{"task_key": task_key_map.get(dep_task_id)} for dep_task_id in task["dependencies"] if task_key_map.get(dep_task_id)]
        
        job_payload["tasks"].append(job_task)
    
    response = requests.post(create_job_url, headers=headers, json=job_payload)
    
    if response.status_code == 200:
        job_id = response.json().get('job_id')
        print(f"Job '{data['workflow_name']}' created successfully. Job ID: {job_id}")
    else:
        raise Exception(f"Error creating job: {response.text}")
    run_job_url = f"{DATABRICKS_HOST}/api/2.1/jobs/run-now"
    run_payload = {
        "job_id": job_id
    }
    
    run_response = requests.post(run_job_url, headers=headers, json=run_payload)
    
    if run_response.status_code == 200:
        run_id = run_response.json().get('run_id')
        print(f"Job {job_id} started successfully. Run ID: {run_id}")
    else:
        raise Exception(f"Error running job: {run_response.text}")
    check_status_url = f"{DATABRICKS_HOST}/api/2.1/jobs/runs/get"
    task_statuses = {}

    while True:
        status_response = requests.get(check_status_url, headers=headers, params={"run_id": run_id})
        
        if status_response.status_code == 200:
            response_data = status_response.json()
            run_status = response_data.get('state').get('life_cycle_state')
            print(f"Run {run_id} status: {run_status}")
            
            # Fetch and print task-level statuses
            tasks = response_data.get('tasks', [])
            for task in tasks:
                task_key = task.get('task_key')  # Use get to avoid KeyError
                task_state = task['state']['life_cycle_state']

                # Try to get the task_id, if not found, use 'N/A'
                task_id = task.get('task_id', 'N/A')  # 'N/A' if task_id is not present
                task_name = task.get('task_name', task_key)  # Fallback to task_key if task_name is not available

                # Check if the task state has changed and print updates
                if task_key not in task_statuses or task_statuses[task_key] != task_state:
                    print(f"Task '{task_name}' (ID: {task_id}) status: {task_state}")
                    
                    # If task has completed, print task information
                    if task_state == 'TERMINATED':
                        task_run_info = task.get('run_info', {})
                        print(f"Task '{task_name}' (ID: {task_id}) completed. Info:")
                        print(f"- Start Time: {task_run_info.get('start_time')}")
                        print(f"- End Time: {task_run_info.get('end_time')}")
                        print(f"- Result State: {task_run_info.get('result_state')}")
                        print(f"- Life Cycle State: {task_state}")

                    task_statuses[task_key] = task_state
            
            if run_status in ['TERMINATED', 'SKIPPED', 'INTERNAL_ERROR']:
                print(f"Job {job_id} completed with status: {run_status}")
                break
        else:
            raise Exception(f"Error fetching job status: {status_response.text}")
        
        time.sleep(1)

# Run the combined function
create_and_run_databricks_job()