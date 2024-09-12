import { Component, OnInit } from '@angular/core';
import Drawflow from 'drawflow';
import interact from 'interactjs';

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  drawflow: any;
  id: any = null;
  data = { name: '' };
  items = [{ name: 'Item 1' }, { name: 'Item 2' }, { name: 'Item 3' }];
  newItemName = '';

  ngOnInit() {
    this.id = document.getElementById('drawflow');
    this.drawflow = new Drawflow(this.id);
    this.drawflow.start();
    this.addLink('test', 'test');
    let label1 = document.querySelector(
      '.connection.node_in_node-2.node_out_node-1.output_1.input_1'
    );

    this.addLabelText(label1, 'Something');

    // Initialize draggable items
    interact('.draggable-item').draggable({
      inertia: true,
      autoScroll: true,
      onmove: this.dragMoveListener,
    });

    // Set up the dropzone
    interact('#drawflow').dropzone({
      accept: '.draggable-item',
      overlap: 0.75,
      ondrop: (event) => {
        const nodeName = event.relatedTarget.getAttribute('data-node-name');
        const x = event.dragEvent.clientX - event.target.getBoundingClientRect().left;
        const y = event.dragEvent.clientY - event.target.getBoundingClientRect().top;
        this.addNode(nodeName, x, y);
      }
    });
  }

  dragMoveListener(event) {
    console.log("dragMoveListener");  
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

  addLink(sourceNodeId: string, targetNodeId: string) {
    this.drawflow.addConnection(sourceNodeId, '', targetNodeId, '');
  }

  addLabelText(bgPath, labelText) {
    const newid = [bgPath.classList].join().replace(/\s/g, '');
    bgPath.childNodes[0].id = newid;
    let textElem = document.createElementNS(bgPath.namespaceURI, 'text');
    let textElemPath = document.createElementNS(
      bgPath.namespaceURI,
      'textPath'
    );
    textElemPath.setAttribute('href', `#${newid}`);
    textElemPath.setAttribute('text-anchor', 'middle');
    textElemPath.setAttribute('startOffset', '50%');
    textElemPath.classList.add('label-text');
    textElemPath.textContent = labelText;
    textElem.appendChild(textElemPath);
    bgPath.appendChild(textElem);
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
      this.items.push({ name: this.newItemName });
      this.newItemName = '';
    } else {
      alert('Please enter an item name');
    }
  }

  deleteItem(index: number) {
    this.items.splice(index, 1);
  }
}