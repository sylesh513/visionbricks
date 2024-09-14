import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { NodeDialogComponent } from './node-dialog/node-dialog.component';
import Drawflow from 'drawflow';
import interact from 'interactjs';

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  encapsulation: ViewEncapsulation.None// Disable encapsulation

})
export class AppComponent implements OnInit {
  drawflow: any;
  id: any = null;
  data = { name: '' };
  items = [{ name: 'Node 1' }, { name: 'Node 2' }, { name: 'Node 3' }];
  newItemName = '';
  constructor(public dialog: MatDialog) {}

  ngOnInit() {
    this.id = document.getElementById('drawflow');
    this.drawflow = new Drawflow(this.id);
    this.drawflow.start();

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
        const index = event.relatedTarget.getAttribute('data-index');
        const x = event.dragEvent.clientX - event.target.getBoundingClientRect().left - 300;
        const y = event.dragEvent.clientY - event.target.getBoundingClientRect().top -40;
        this.addNode(nodeName, x, y);
        // Check for cycles after adding the node
        // if (this.hasCycle()) {
        //   alert('Error: Cycle detected in the workflow!');
        // }
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
  }
  openDialog(): void {
    const dialogRef = this.dialog.open(NodeDialogComponent, {
      width: '250px',
      data: { name: '', mode: 'create' }
    });
  
    dialogRef.afterClosed().subscribe(result => {
      if (result && result.action === 'create') {
        this.newItemName = result.name;
        if (typeof this.newItemName === 'string') {
          this.items.push({ name: this.newItemName });

        }
      }
    });
  }

  dragMoveListener(event) {
    const target = event.target;
    const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
    const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

    target.style.transform = `translate(${x}px, ${y}px)`;
    target.setAttribute('data-x', x);
    target.setAttribute('data-y', y);
  }

  addNode(nodeName: string, x: number, y: number) {
    var html = document.createElement('div');
    html.innerHTML = nodeName;
    this.drawflow.registerNode('test', html);
    this.drawflow.addNode(
      nodeName,
      1,
      1,
      x,
      y,
      'github',
      this.data,
      'test',
      true
    );
  }
  openEditDialog(index: number): void {
    const dialogRef = this.dialog.open(NodeDialogComponent, {
      width: '250px',
      data: { name: this.items[index].name, index: index, mode: 'edit' }
    });
  
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (result.action === 'edit') {
          this.items[index].name = result.name;
        } else if (result.action === 'delete') {
          this.deleteItem(index);
        }
      }
    });
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
        this.items.push({ name: this.newItemName });
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

  exportWorkflow() {
    const workflowData = this.drawflow.export();
    console.log('Exported Workflow Data:', workflowData);
    const processedData = this.processWorkflowData(workflowData);
    this.downloadWorkflow(processedData);
 
    // You can now process or store the workflowData as needed
  }
  processWorkflowData(workflowData: any): any {
    const processedData = { nodes: [] };
    for (const key in workflowData.drawflow.Home.data) {
      const node = workflowData.drawflow.Home.data[key];
      const itemName = this.items.find(item => item.name === node.name)?.name || node.name;
      const connections = [];
  
      // Collect names of connected nodes
      for (const outputKey in node.outputs) {
        const outputConnections = node.outputs[outputKey].connections;
        for (const connection of outputConnections) {
          const connectedNode = workflowData.drawflow.Home.data[connection.node];
          const connectedNodeName = this.items.find(item => item.name === connectedNode.name)?.name || connectedNode.name;
          connections.push(connectedNodeName);
        }
      }
  
      processedData.nodes.push({
        id: node.id,
        name: itemName,
        connections: connections
      });
    }
    return processedData;
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