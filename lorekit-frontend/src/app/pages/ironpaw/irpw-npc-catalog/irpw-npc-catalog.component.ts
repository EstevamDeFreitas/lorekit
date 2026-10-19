import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Dialog } from '@angular/cdk/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  calculateNpc,
  NPC_ATTRIBUTES,
  NPC_DAMAGE,
  validateNpcDefinition,
  type NpcAction,
  type NpcAttribute,
  type NpcDamage,
  type NpcDefinition,
  type NpcTag,
  type NpcTagType,
} from '@lorekit/ironpaw';
import {
  IrpwNpcCatalogService,
  type IrpwCatalogNpc,
} from '../../../services/irpw-npc-catalog.service';
import { ImageService } from '../../../services/image.service';
import { ImageUploaderComponent } from '../../../components/ImageUploader/image-uploader.component';
import { AssetUrlPipe } from '../../../pipes/asset-url.pipe';

@Component({
  selector: 'irpw-npc-catalog',
  imports: [ReactiveFormsModule, AssetUrlPipe],
  templateUrl: './irpw-npc-catalog.component.html',
  styleUrl: './irpw-npc-catalog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IrpwNpcCatalogComponent {
  private readonly catalog = inject(IrpwNpcCatalogService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly images = inject(ImageService);
  private readonly dialog = inject(Dialog);
  readonly all = signal(this.catalog.list());
  readonly selected = signal<IrpwCatalogNpc | null>(null);
  readonly search = signal('');
  readonly includeArchived = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly version = signal(0);
  readonly attributes = NPC_ATTRIBUTES;
  readonly damages = NPC_DAMAGE;
  readonly attributeLabels: Record<NpcAttribute, string> = {
    BODY: 'Corpo',
    MIND: 'Mente',
    PRESENCE: 'Presença',
    TECHNIQUE: 'Técnica',
    PERCEPTION: 'Percepção',
  };
  readonly damageLabels: Record<NpcDamage, string> = {
    light: 'Leve',
    moderate: 'Moderado',
    severe: 'Severo',
    grave: 'Grave',
    devastating: 'Devastador',
  };
  readonly tagTypes: Array<{ value: NpcTagType; label: string }> = [
    { value: 'competence', label: 'Competência' },
    { value: 'property', label: 'Propriedade' },
    { value: 'trigger', label: 'Gatilho' },
    { value: 'limitation', label: 'Limitação' },
  ];
  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    color: '#a1a1aa',
    concept: '',
    threatLevel: new FormControl<number | null>(null),
    protection: '',
    lifeAdjustment: 0,
    resistanceAdjustment: 0,
    tags: new FormArray<ReturnType<IrpwNpcCatalogComponent['tagForm']>>([]),
    actions: new FormArray<ReturnType<IrpwNpcCatalogComponent['actionForm']>>(
      [],
    ),
    signatures: new FormArray<
      ReturnType<IrpwNpcCatalogComponent['actionForm']>
    >([]),
    resistances: '',
    weaknesses: '',
    notes: '',
  });
  readonly filtered = computed(() => {
    const search = this.search().trim().toLocaleLowerCase('pt-BR');
    return this.all().filter((npc) =>
      `${npc.name} ${npc.definition.concept}`
        .toLocaleLowerCase('pt-BR')
        .includes(search),
    );
  });
  readonly ruleErrors = computed(() => {
    this.version();
    return validateNpcDefinition(this.definition());
  });
  readonly preview = computed(() => {
    this.version();
    try {
      return calculateNpc(this.definition());
    } catch {
      return null;
    }
  });
  readonly portrait = computed(() => {
    this.version();
    const id = this.selected()?.id;
    return id ? this.images.getImage('IRPWNpc', id, 'portrait') : null;
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.version.update((value) => value + 1);
      this.notice.set('');
    });
  }

  reload(archived = this.includeArchived()): void {
    this.includeArchived.set(archived);
    try {
      this.all.set(this.catalog.list(archived));
    } catch (error) {
      this.fail(error);
    }
  }

  select(npc: IrpwCatalogNpc): void {
    if (this.form.dirty) {
      this.error.set(
        'Salve ou descarte as alterações antes de abrir outro PNJ.',
      );
      return;
    }
    this.load(npc);
  }

  create(): void {
    if (!this.form.dirty) this.load(this.catalog.createDraft());
  }

  cancel(): void {
    const id = this.selected()?.id;
    if (id) this.load(this.catalog.get(id)!);
    else {
      this.selected.set(null);
      this.form.markAsPristine();
      this.error.set('');
    }
  }

  save(): void {
    const selected = this.selected();
    if (!selected) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set('Confira o nome do PNJ.');
      return;
    }
    try {
      const saved = this.catalog.save({
        ...selected,
        name: this.form.controls.name.value,
        color: this.form.controls.color.value,
        definition: this.definition(),
      });
      this.load(saved);
      this.reload();
      this.notice.set('PNJ salvo.');
    } catch (error) {
      this.fail(error);
    }
  }

  duplicate(): void {
    const selected = this.selected();
    if (!selected?.id || this.form.dirty) return;
    try {
      this.load(this.catalog.duplicate(selected));
      this.reload();
      this.notice.set('Cópia criada.');
    } catch (error) {
      this.fail(error);
    }
  }

  archive(): void {
    const selected = this.selected();
    if (!selected?.id || this.form.dirty) return;
    try {
      this.catalog.archive(selected.id);
      this.selected.set(null);
      this.form.markAsPristine();
      this.reload();
      this.notice.set(
        'PNJ arquivado. As cópias nas Histórias foram preservadas.',
      );
    } catch (error) {
      this.fail(error);
    }
  }

  uploadPortrait(): void {
    const selected = this.selected();
    if (!selected?.id || this.form.dirty) return;
    this.dialog
      .open(ImageUploaderComponent, {
        data: {
          entityTable: 'IRPWNpc',
          entityId: selected.id,
          usageKey: 'portrait',
          aspectRatio: 1,
        },
        width: 'min(95vw, 700px)',
      })
      .closed.subscribe(() => {
        try {
          const current = this.catalog.get(selected.id);
          if (!current) return;
          const image = this.images.getImage(
            'IRPWNpc',
            selected.id,
            'portrait',
          );
          this.load(
            this.catalog.save({
              ...current,
              portraitImageId: image?.id ?? null,
            }),
          );
          this.reload();
        } catch (error) {
          this.fail(error);
        }
      });
  }

  addTag(): void {
    this.form.controls.tags.push(this.tagForm());
    this.form.markAsDirty();
  }
  addAction(signature = false): void {
    const list = signature
      ? this.form.controls.signatures
      : this.form.controls.actions;
    if (!signature && list.length >= 4) return;
    list.push(this.actionForm());
    this.form.markAsDirty();
  }
  remove(list: 'tags' | 'actions' | 'signatures', index: number): void {
    this.form.controls[list].removeAt(index);
    this.form.markAsDirty();
  }
  tagTypeChanged(index: number): void {
    const tag = this.form.controls.tags.at(index);
    if (tag.controls.type.value !== 'competence')
      tag.patchValue({ modifier: 0, diceModifier: 0 });
  }
  clearProtectionAdjustment(): void {
    if (!this.form.controls.protection.value.trim())
      this.form.controls.resistanceAdjustment.setValue(0);
  }

  private load(npc: IrpwCatalogNpc): void {
    this.selected.set(structuredClone(npc));
    this.form.controls.tags.clear();
    this.form.controls.actions.clear();
    this.form.controls.signatures.clear();
    npc.definition.tags.forEach((tag) =>
      this.form.controls.tags.push(this.tagForm(tag)),
    );
    npc.definition.actions.forEach((action) =>
      this.form.controls.actions.push(this.actionForm(action)),
    );
    npc.definition.signatures.forEach((action) =>
      this.form.controls.signatures.push(this.actionForm(action)),
    );
    const { tags, actions, signatures, version, ...definition } =
      npc.definition;
    this.form.patchValue({ ...definition, name: npc.name, color: npc.color });
    this.form.markAsPristine();
    this.error.set('');
    this.notice.set('');
    this.version.update((value) => value + 1);
  }

  private definition(): NpcDefinition {
    const { name, color, ...definition } = this.form.getRawValue();
    return { version: 1, ...definition };
  }
  private tagForm(tag?: NpcTag) {
    return this.fb.group({
      id: tag?.id ?? crypto.randomUUID(),
      name: tag?.name ?? '',
      type: this.fb.control<NpcTagType>(tag?.type ?? 'competence'),
      description: tag?.description ?? '',
      attribute: new FormControl<NpcAttribute | null>(tag?.attribute ?? null),
      diceModifier: tag?.diceModifier ?? 0,
      modifier: tag?.modifier ?? 0,
      context: tag?.context ?? '',
    });
  }
  private actionForm(action?: NpcAction) {
    return this.fb.group({
      id: action?.id ?? crypto.randomUUID(),
      name: action?.name ?? '',
      attribute: this.fb.control<NpcAttribute>(action?.attribute ?? 'BODY'),
      description: action?.description ?? '',
      damage: new FormControl<NpcDamage | null>(action?.damage ?? null),
      target: action?.target ?? '',
      resistance: action?.resistance ?? '',
      usage: action?.usage ?? '',
      cost: action?.cost ?? '',
      cooldown: action?.cooldown ?? '',
    });
  }
  private fail(error: unknown): void {
    this.error.set(
      error instanceof Error
        ? error.message
        : 'Não foi possível salvar. Tente novamente.',
    );
  }
}
