import { Component } from '@angular/core';

//TODO: Implementar funcionalidade de filtragem, busca por filtros, fixação de "tags" de pesquisa como Mundo, Localidade, etc.
@Component({
  selector: 'app-search',
  imports: [],
  template: `
    <div class="w-full flex flex-row items-center gap-1 rounded-md bg-zinc-925 border border-zinc-700 text-white focus:outline-none focus-within:border-white">
      <div class="border-r w-14 h-7 flex flex-row justify-center items-center">
        <i class="fa fa-search "></i>
      </div>
      <input
        type="text"
        placeholder="Pesquisar..."
        class="w-full p-2 bg-transparent border-none outline-none placeholder:text-white/10"
      />
    </div>
  `,
  styleUrl: './search.component.css',
})
export class SearchComponent { }
