import { Component, Inject, ChangeDetectorRef } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-node-dialog',
  templateUrl: './node-dialog.component.html',
  styleUrls: ['./node-dialog.component.css']
})
export class NodeDialogComponent {
  selectedFile: File | null = null;

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
    this.dialogRef.close({ action: action, name: this.data.name, params: this.data.params, file: this.selectedFile });
    this.cdr.detectChanges(); // Trigger change detection if necessary
  }

  onDelete(): void {
    console.log('delete');
    this.dialogRef.close({ action: 'delete' });
    this.cdr.detectChanges(); // Trigger change detection if necessary
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const fileType = file.name.split('.').pop()?.toLowerCase();
      if (fileType === 'py' || fileType === 'ipynb') {
        this.selectedFile = file;
      } else {
        alert('Invalid file type. Please upload a .py or .ipynb file.');
        this.selectedFile = null;
      }
    }
  }
}