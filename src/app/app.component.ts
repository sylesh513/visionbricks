import { Component, OnInit, VERSION, ViewChild } from '@angular/core';
import Drawflow from 'drawflow';

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  drawflow: any;
  id: any = null;
  data = { name: '' };
  ngOnInit() {
    this.id = document.getElementById('drawflow');
    this.drawflow = new Drawflow(this.id);
    this.drawflow.start();
    this.addNode('node1', 10, 100);
    this.addNode('node2', 100, 200);
    this.addNode('node3', 200, 300);
    this.addLink('test', 'test');
    let label1 = document.querySelector(
      '.connection.node_in_node-2.node_out_node-1.output_1.input_1'
    );

    this.addLabelText(label1, 'Something');
  }
  addNode(nodeName, x, y) {
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
}
