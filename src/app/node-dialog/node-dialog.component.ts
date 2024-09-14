import { Component, Inject, ChangeDetectorRef } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-node-dialog',
  templateUrl: './node-dialog.component.html',
  styleUrls: ['./node-dialog.component.css']
})
export class NodeDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<NodeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { name: string, mode: string, params?: string },
    private cdr: ChangeDetectorRef
  ) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onCreate(): void {
    const action = this.data.mode === 'edit' ? 'save' : 'create';
    this.dialogRef.close({ action: action, name: this.data.name, params: this.data.params });
    this.cdr.detectChanges(); // Trigger change detection if necessary
  }

  onDelete(): void {
    console.log('delete');
    this.dialogRef.close({ action: 'delete' });
    this.cdr.detectChanges(); // Trigger change detection if necessary
  }
}