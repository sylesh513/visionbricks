import { Component, OnInit, ViewEncapsulation, HostListener } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { NodeDialogComponent } from './node-dialog/node-dialog.component';
import Drawflow from 'drawflow';
import interact from 'interactjs';

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  encapsulation: ViewEncapsulation.None // Disable encapsulation
})
export class AppComponent implements OnInit {
  drawflow: any;
  id: any = null;
  items = [{ name: 'Node 1', params: '', file: null }];
  newItemName = '';

  constructor(public dialog: MatDialog) {}

  ngOnInit() {
    this.id = document.getElementById('drawflow');
    this.drawflow = new Drawflow(this.id);
    this.drawflow.start();

    // Load workflow data from localStorage
    const savedWorkflow = localStorage.getItem('workflowData');
    if (savedWorkflow) {
      this.importWorkflow(savedWorkflow);
    }

    // Initialize draggable items
    interact('.draggable-item').draggable({
      inertia: true,
      autoScroll: true,
      onstart: (event) => {
        // Store the original position
        const target = event.target;
        const rect = target.getBoundingClientRect();
        target.setAttribute('data-start-x', rect.left);
        target.setAttribute('data-start-y', rect.top);
      },
      onmove: this.dragMoveListener,
      onend: (event) => {
        if (!event.target.dropzone) {
          const startX = event.target.getAttribute('data-start-x');
          const startY = event.target.getAttribute('data-start-y');
          // Snap back to original position
          event.target.style.transform = 'translate(0px, 0px)';
          event.target.style.left = `${startX}px`;
          event.target.style.top = `${startY}px`;
          event.target.removeAttribute('data-x');
          event.target.removeAttribute('data-y');
        }
      }
    });

    // Set up the dropzone
    interact('#drawflow').dropzone({
      accept: '.draggable-item', // Accept items with class .draggable-item
      overlap: 0.75,
      ondrop: (event) => {
        const nodeName = event.relatedTarget.getAttribute('data-node-name');
        const x = event.dragEvent.clientX - event.target.getBoundingClientRect().left - 300;
        const y = event.dragEvent.clientY - event.target.getBoundingClientRect().top - 40;
        this.addNode(nodeName, x, y);
      },
      ondropdeactivate: (event) => {
        const startX = event.relatedTarget.getAttribute('data-start-x');
        const startY = event.relatedTarget.getAttribute('data-start-y');
        event.relatedTarget.style.transform = 'translate(0px, 0px)';
        event.relatedTarget.style.left = `${startX}px`;
        event.relatedTarget.style.top = `${startY}px`;
        event.relatedTarget.removeAttribute('data-x');
        event.relatedTarget.removeAttribute('data-y');
      }
    });

    this.drawflow.on('connectionCreated', (event) => {
      console.log('Connection Created:', event);
      const outputNode = this.drawflow.getNodeFromId(event.output_id);
      const inputNode = this.drawflow.getNodeFromId(event.input_id);

      if (outputNode.name === inputNode.name) {
        alert('Error: Cannot connect two consecutive nodes with the same name!');
        this.drawflow.removeSingleConnection(event.output_id, event.input_id, event.output_class, event.input_class);
      } else if (this.hasCycle()) {
        alert('Error: Cycle detected in the workflow!');
        this.drawflow.removeSingleConnection(event.output_id, event.input_id, event.output_class, event.input_class);
      }
    });

    this.id.addEventListener('dblclick', (event) => {
      const target = event.target as HTMLElement;
      const nodeElement = target.closest('.drawflow-node');
      if (nodeElement) {
        const nodeId = nodeElement.id.replace('node-', '');
        const node = this.drawflow.getNodeFromId(nodeId);
        const index = this.items.findIndex(item => item.name === node.name);
        console.log('Node Index:', index);
        if (index !== -1) {
          this.openEditDialog(index);
        }
      }
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    // Save workflow data to localStorage before the user closes the tab or reloads the page
    const workflowData = this.drawflow.export();
    const processedData = this.processWorkflowData(workflowData);
    localStorage.setItem('workflowData', JSON.stringify(processedData));
  }

  openDialog(): void {
    const dialogRef = this.dialog.open(NodeDialogComponent, {
      width: '300px',
      data: { name: '', mode: 'create', params: '' } // Initialize params
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.action === 'create') {
        this.newItemName = result.name;
        const newItemParams = result.params;

        if (typeof this.newItemName === 'string') {
          this.items.push({ name: this.newItemName, params: newItemParams, file: result.file });
        }
      }
    });
  }

  openContextMenu(event: MouseEvent, index: number): void {
    // Create a context menu
    const contextMenu = document.createElement('div');
    contextMenu.classList.add('context-menu');
    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.style.left = `${event.clientX}px`;

    // Add menu items
    const editItem = document.createElement('div');
    editItem.classList.add('context-menu-item');
    editItem.innerText = 'Edit';
    editItem.addEventListener('click', () => {
      this.openEditDialog(index);
      document.body.removeChild(contextMenu);
    });

    const deleteItem = document.createElement('div');
    deleteItem.classList.add('context-menu-item');
    deleteItem.innerText = 'Delete';
    deleteItem.addEventListener('click', () => {
      this.deleteItem(index);
      document.body.removeChild(contextMenu);
    });

    contextMenu.appendChild(editItem);
    contextMenu.appendChild(deleteItem);

    // Remove any existing context menu
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
      document.body.removeChild(existingMenu);
    }

    // Add the context menu to the body
    document.body.appendChild(contextMenu);

    // Remove the context menu when clicking outside
    document.addEventListener('click', () => {
      if (contextMenu) {
        document.body.removeChild(contextMenu);
      }
    }, { once: true });
  }

  dragMoveListener(event) {
    const target = event.target;
    const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
    const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

    target.style.transform = `translate(${x}px, ${y}px)`;
    target.setAttribute('data-x', x);
    target.setAttribute('data-y', y);
  }

  addNode(nodeName: string, x: number, y: number): number {
    var html = document.createElement('div');
    html.innerHTML = nodeName;
    this.drawflow.registerNode('test', html);
    return this.drawflow.addNode(
      nodeName,
      1,
      1,
      x,
      y,
      'github',
      this.items,
      'test',
      true
    );
  }

  openEditDialog(index: number): void {
    const dialogRef = this.dialog.open(NodeDialogComponent, {
      width: '300px', // Set the desired width for the dialog
      maxWidth: '100%', // Ensure the dialog does not exceed the screen width
      data: { 
        name: this.items[index].name, 
        params: this.items[index].params, 
        file: this.items[index].file, // Include the file in the dialog data
        index: index, 
        mode: 'edit' 
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.action === 'save') {
        this.items[index].name = result.name;
        this.items[index].params = result.params;
        if (result.file) {
          this.items[index].file = result.file; // Save the file with the node
        }
      } else if (result && result.action === 'delete') {
        this.deleteItem(index);
      }
    });
  }

  uploadFile(file: File, index: number): void {
    // Implement the file upload logic here
    const formData = new FormData();
    formData.append('file', file);

    // Store the file in the items array
    this.items[index].file = file;
    console.log(this.items);

    // Use your preferred method to upload the file to the API
    // Example using HttpClient:
    // this.http.post('your-api-endpoint', formData).subscribe(response => {
    //   console.log('File uploaded successfully', response);
    // });
  }

  removeNodeFromDrawflow(index: number) {
    const item = document.querySelector(`.draggable-item[data-index="${index}"]`);
    if (item) {
      (item as HTMLElement).style.display = 'none';
      setTimeout(() => {
        (item as HTMLElement).style.display = '';
      }, 0);
    }
  }

  runWorkflow(): void {
    // Check if each node has a file
    for (const item of this.items) {
      console.log("newnew");
      console.log(item.file.name);

      if (!item.file.name|| item.file.name === 'none' || item.file.name === ''|| item.file.name === undefined ) {
        alert(`Error: Node "${item.name}" does not have an associated file.`);
        return; // Stop the workflow from running
      }
    }
  
    console.log('Run workflow');
    const workflowData = this.drawflow.export();
    const processedData = this.processWorkflowData(workflowData);
  
    // Send the processed data to the server
    this.sendWorkflowData(processedData); 
  }

  sendWorkflowData(workflowData: any): void {
    const formData = new FormData();
    formData.append('workflowData', JSON.stringify(workflowData, null, 2));

    // Append files to the formData
    workflowData.nodes.forEach((node, index) => {
      if (node.file) {
        formData.append(node.name, node.file);
      }
    });

    const url = 'http://127.0.0.1:5000/upload_workflow'; // Replace with your API endpoint
    fetch(url, {
      method: 'POST',
      body: formData
    })
      .then(response => response.json())
      .then(data => {
        console.log('Workflow data uploaded successfully:', data);
      })
      .catch(error => {
        console.error('Error uploading workflow data:', error);
      });
    console.log('Sending workflow data to server:', workflowData);
  }

  createNode() {
    const nodeNameInput = <HTMLInputElement>document.getElementById('nodeNameInput');
    const nodeName = nodeNameInput.value;
    if (nodeName) {
      this.addNode(nodeName, 50, 50); // You can adjust the x and y coordinates as needed
      nodeNameInput.value = ''; // Clear the input field after creating the node
    } else {
      alert('Please enter a node name');
    }
  }

  addItem() {
    if (this.newItemName) {
      if (this.items.some(item => item.name === this.newItemName)) {
        alert('Item with this name already exists');
      } else {
        this.items.push({ name: this.newItemName, params: '', file: null });
        this.newItemName = '';
      }
    } else {
      alert('Please enter an item name');
    }
  }

  deleteItem(index: number) {
    this.items.splice(index, 1);
    console.log(this.items);
  }

  importWorkflow(jsonData: string) {
    this.items.length = 0; // Clear the items array
    try {
      const workflowData = JSON.parse(jsonData);
  
      if (!this.drawflow) {
        this.id = document.getElementById('drawflow');
        this.drawflow = new Drawflow(this.id);
        this.drawflow.start();
      } else {
        this.drawflow.clear(); // Clear the current Drawflow data
      }
  
      const nodeIdMap = new Map<string, number>();
      const nodeNamesSet = new Set<string>(); // Set to track node names
  
      // First, add all nodes to the Drawflow
      workflowData.nodes.forEach(node => {
        const nodeId = this.addNode(node.name, node.position.x, node.position.y); // Use positions
        nodeIdMap.set(node.name, nodeId);
        const drawflowNode = this.drawflow.getNodeFromId(nodeId);
        drawflowNode.data = { params: node.params, file: node.file };

        // Check for duplicate node names
        if (!nodeNamesSet.has(node.name)) {
          nodeNamesSet.add(node.name);
  
          this.items.push({ name: node.name, params: JSON.stringify(node.params) ,file: node.file });
        } else {
          console.warn(`Duplicate node name found: ${node.name}. Skipping this node.`);
        }
      });
  
      // Then, recreate connections
      workflowData.nodes.forEach(node => {
        node.connections.forEach(connection => {
          const outputNodeId = nodeIdMap.get(node.name);
          const inputNodeId = nodeIdMap.get(connection);
          if (outputNodeId && inputNodeId) {
            this.drawflow.addConnection(outputNodeId, inputNodeId, 'output_1', 'input_1');
          }
        });
      });
  
      console.log('Workflow imported successfully:', workflowData);
    } catch (error) {
      console.error('Error importing workflow data:', error);
    }
  }
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const jsonData = e.target.result;
        this.importWorkflow(jsonData);
      };
      reader.readAsText(file);
    }
  }

  clearWorkflow() {
    this.drawflow.clear();
    this.items = [];
    localStorage.removeItem('workflowData');
  }

  exportWorkflow() {
    const workflowData = this.drawflow.export();
    const processedData = this.processWorkflowData(workflowData);
    console.log('Exported Workflow Data:', processedData);
    if(processedData !== undefined) {
    this.downloadWorkflow(processedData);
    }
  }

  triggerFileInput() {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  processWorkflowData(workflowData: any): any {
    const processedData = { nodes: [] };
    for (const key in workflowData.drawflow.Home.data) {
      const node = workflowData.drawflow.Home.data[key];
      const item = this.items.find(item => item.name === node.name);
      const connections = [];
  
      // Collect names of connected nodes
      for (const outputKey in node.outputs) {
        const outputConnections = node.outputs[outputKey].connections;
        for (const connection of outputConnections) {
          const connectedNode = workflowData.drawflow.Home.data[connection.node];
          connections.push(connectedNode.name);
        }
      }
      
      try {
        processedData.nodes.push({
          id: node.id,
          name: node.name,
          params: item.params ? JSON.parse(item.params) : {}, // Parse if params is a string
          file: item ? item.file : null,
          filePath: item && item.file ? item.file.path : null, // Include full file path
          connections: connections,
          position: { x: node.pos_x, y: node.pos_y } // Include positions
        });
        return processedData;

      } catch (error) {
        alert('Error parsing JSON parameters: ' + error.message);
        return;
      }
    }
  }

  downloadWorkflow(workflowData: any) {
    const dataStr = JSON.stringify(workflowData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workflow.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  hasCycle(): boolean {
    const workflowData = this.drawflow.export();
    const graph = this.buildGraph(workflowData);
    return this.detectCycle(graph);
  }

  buildGraph(workflowData: any): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    for (const key in workflowData.drawflow.Home.data) {
      const node = workflowData.drawflow.Home.data[key];
      graph.set(key, []);
      for (const outputKey in node.outputs) {
        const connections = node.outputs[outputKey].connections;
        for (const connection of connections) {
          graph.get(key).push(connection.node);
        }
      }
    }
    return graph;
  }

  detectCycle(graph: Map<string, string[]>): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string): boolean => {
      if (!visited.has(node)) {
        visited.add(node);
        recStack.add(node);

        const neighbors = graph.get(node) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor) && dfs(neighbor)) {
            return true;
          } else if (recStack.has(neighbor)) {
            return true;
          }
        }
      }
      recStack.delete(node);
      return false;
    };

    for (const node of graph.keys()) {
      if (dfs(node)) {
        return true;
      }
    }
    return false;
  }
}