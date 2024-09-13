import { Component } from '@angular/core';
import { CdkDropList, CdkDrag, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms'; // Import FormsModule

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
  standalone: true,
  imports: [CdkDropList, CdkDrag, FormsModule], // Add FormsModule here
})
export class SidebarComponent {
  todo = ['Get to work', 'Pick up groceries', 'Go home', 'Fall asleep'];
  newItemName = '';

  addItem() {
    if (this.newItemName) {
      this.todo.push(this.newItemName);
      this.newItemName = '';
    } else {
      alert('Please enter an item name');
    }
  }

  deleteItem(index: number) {
    this.todo.splice(index, 1);
  }

  drop(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.todo, event.previousIndex, event.currentIndex);
  }
}