import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms'; // Import FormsModule
import { DragDropModule } from '@angular/cdk/drag-drop'; // Import DragDropModule
import { AppComponent } from './app.component';
import { SidebarComponent } from './sidebar/sidebar.component';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    DragDropModule, // Include DragDropModule in imports array
    SidebarComponent // Import SidebarComponent instead of declaring it
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }