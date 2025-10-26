import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { LocationCategory } from '../models/location.model';
import { environment } from '../../enviroments/environment';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../app.config';

@Injectable({
  providedIn: 'root'
})
export class LocationCategoriesService {
  private crud : CrudHelper;

  constructor(private dbProvider : DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  //Location Category
  getLocationCategories() : LocationCategory[] {
    return this.crud.findAll('LocationCategory');
  }

  saveLocationCategory(category: LocationCategory) : LocationCategory {
    if (category.id != '') {
      return <LocationCategory>this.crud.update('LocationCategory', category.id, category);
    } else {
      return <LocationCategory>this.crud.create('LocationCategory', category);
    }
  }

  deleteLocationCategory(category: LocationCategory) {
    return this.crud.delete('LocationCategory', category.id);
  }

  getLocationCategoryById(categoryId: string) : LocationCategory {
    return this.crud.findById('LocationCategory', categoryId);
  }

}
