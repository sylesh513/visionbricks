import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms'; // Import FormsModule
import { DragDropModule } from '@angular/cdk/drag-drop'; // Import DragDropModule
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'; // Import BrowserAnimationsModule
import { MatDialogModule } from '@angular/material/dialog'; // Import MatDialogModule
import { MatButtonModule } from '@angular/material/button'; // Import MatButtonModule
import { MatInputModule } from '@angular/material/input'; // Import MatInputModule

import { AppComponent } from './app.component';
import { NodeDialogComponent } from './node-dialog/node-dialog.component'; // Import NodeDialogComponent

@NgModule({
  declarations: [
    AppComponent,
    NodeDialogComponent, // Add NodeDialogComponent to declarations
  ],
  imports: [
    BrowserModule,
    FormsModule,
    DragDropModule, // Include DragDropModule in imports array
    BrowserAnimationsModule, // Include BrowserAnimationsModule in imports array
    MatDialogModule, // Include MatDialogModule in imports array
    MatButtonModule, // Include MatButtonModule in imports array
    MatInputModule,
     // Include MatInputModule in imports array
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }