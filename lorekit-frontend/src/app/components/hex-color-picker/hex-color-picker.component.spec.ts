import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HexColorPickerComponent } from './hex-color-picker.component';

describe('HexColorPickerComponent', () => {
  let fixture: ComponentFixture<HexColorPickerComponent>;
  let component: HexColorPickerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HexColorPickerComponent] }).compileComponents();
    fixture = TestBed.createComponent(HexColorPickerComponent);
    component = fixture.componentInstance;
  });

  it('emits palette, custom and cleared values', () => {
    const emitted: Array<string | undefined> = [];
    component.valueChange.subscribe(value => emitted.push(value));

    component.select('#ef4444');
    component.customColor({ target: { value: '#123456' } } as unknown as Event);
    component.clear();

    expect(emitted).toEqual(['#ef4444', '#123456', undefined]);
  });
});
