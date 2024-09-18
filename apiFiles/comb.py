from flask import Flask, request, jsonify
import json
import os
import uuid
from create_node_connectors import DAG, Node

app = Flask(__name__)
DATA_FILE = 'workflows.json'
workflows = {}
dag = {}

def initialize_json_file():
     if not os.path.exists(DATA_FILE) or os.path.getsize(DATA_FILE) == 0:
        with open(DATA_FILE, 'w') as f:
            json.dump({}, f)

def load_workflows():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return {}
    return {}

def save_workflows():
    """Save workflows to the JSON file."""
    with open(DATA_FILE, 'w') as file:
        json.dump(workflows, file, indent=4)

def initialize_dag(workflow_id):
    """Initialize the DAG for a specific workflow with a unique JSON file."""
    global dag
    if workflow_id not in dag:
        json_file = f'dag_{workflow_id}.json'
        dag[workflow_id] = DAG(json_file=json_file)

@app.before_first_request
def setup():
    """Setup function to initialize workflows and DAGs."""
    initialize_json_file()
    global workflows
    workflows = load_workflows()
    global dag
    dag = {workflow_id: DAG(json_file=f'dag_{workflow_id}.json') for workflow_id in workflows.keys()}

@app.route('/create_workflow', methods=['POST'])
def create_workflow():
    try:
        data = request.json
        workflow_name = data['name']
        workflow_description = data['description']
    except (TypeError, KeyError):
        return jsonify({'error': 'Invalid input, missing "name" or "description"'}), 400

    # Check if a workflow with the same name already exists
    if any(workflow['name'] == workflow_name for workflow in workflows.values()):
        return jsonify({'error': 'Workflow with this name already exists'}), 400

    # Generate unique workflow ID
    workflow_id = str(uuid.uuid4())

    # Create new workflow dictionary
    workflow = {
        'id': workflow_id,
        'name': workflow_name,
        'description': workflow_description,
        'nodes': {}
    }

    # Add workflow to dictionary
    workflows[workflow_id] = workflow
    initialize_dag(workflow_id)

    # Save workflows to JSON file
    save_workflows()

    return jsonify({'message': 'Workflow created successfully', 'id': workflow_id})

@app.route('/add_node', methods=['POST'])
def add_node_route():
    data = request.json
    workflow_id = data.get('workflow_id')
    if workflow_id not in dag:
        return jsonify({'error': 'Workflow not found'}), 404
    
    name = data.get('name')
    description = data.get('description')
    connections = data.get('connections', [])
    if not name or not description:
        return jsonify({'message': 'Name and description are required'}), 400

    node_id = dag[workflow_id].add_node(name, description, connections)
    if node_id is None:
        return jsonify({'error': 'Node with this name already exists'}), 400

    # Add node to workflow data
    workflows[workflow_id]['nodes'][node_id] = {
        'name': name,
        'description': description,
        'connections': connections
    }

    # Save workflows to JSON file
    save_workflows()

    return jsonify({'message': 'Node added successfully', 'node_id': node_id})


@app.route('/get_graph/<string:workflow_id>', methods=['GET'])
def get_graph(workflow_id):
    if workflow_id not in dag:
        return jsonify({'error': 'Workflow not found'}), 404

    graph_data = dag[workflow_id].get_graph_data()
    return jsonify(graph_data)

@app.route('/')
def home():
    return 'Server is running!'

@app.route('/workflows', methods=['GET'])
def list_workflows():
    return jsonify(workflows)

@app.route('/workflows/<string:workflow_id>', methods=['GET'])
def get_workflow_by_id(workflow_id):
    workflow = workflows.get(workflow_id)
    if workflow:
        return jsonify(workflow)
    return jsonify({"error": "Workflow not found"}), 404

@app.route('/workflows/update', methods=['PUT'])
def update_workflow_by_id():
    data = request.json
    workflow_id = data.get("workflow_id")
    if workflow_id not in workflows:
        return jsonify({"error": "Workflow not found"}), 404

    name = data.get('name')
    description = data.get('description')

    if not name and not description:
        return jsonify({"error": "No data provided to update"}), 400

    if name:
        # Check if a workflow with the same name already exists
        existing_workflow = next((workflow for workflow in workflows.values() if workflow['name'] == name and workflow['id'] != workflow_id), None)
        if existing_workflow:
            return jsonify({'error': 'Workflow with this name already exists'}), 400
        workflows[workflow_id]['name'] = name

    if description:
        workflows[workflow_id]['description'] = description

    # Save workflows to JSON file
    save_workflows()

    return jsonify({'message': 'Workflow updated successfully'})

if __name__ == '__main__':
    app.run(debug=True)
