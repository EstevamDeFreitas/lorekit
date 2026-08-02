import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../enviroments/environment';
import { CloudSyncApiService, exactArrayBuffer } from './cloud-sync-api.service';

describe('CloudSyncApiService', () => {
  let api: CloudSyncApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CloudSyncApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(CloudSyncApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('uploads a Uint8Array as its exact binary view', async () => {
    const backing = new Uint8Array([99, 1, 2, 3, 88]);
    const bytes = backing.subarray(1, 4);
    const promise = api.uploadBlob(
      '9c114be3-dc27-4d68-913e-08f7b003df52',
      '36c6c098-731d-4f16-8e52-436802ba07eb',
      bytes,
      'image/png',
      '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
      'imagem.png',
    );

    const request = http.expectOne(
      `${environment.apiUrl}/vaults/9c114be3-dc27-4d68-913e-08f7b003df52/blobs/36c6c098-731d-4f16-8e52-436802ba07eb`,
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body instanceof ArrayBuffer).toBeTrue();
    expect(Array.from(new Uint8Array(request.request.body as ArrayBuffer))).toEqual([1, 2, 3]);
    expect(request.request.headers.get('Content-Type')).toBe('image/png');
    expect(request.request.headers.get('X-Content-Sha256')).toBe(
      '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
    );
    request.flush({});

    await promise;
  });

  it('preserves an existing ArrayBuffer', () => {
    const bytes = new Uint8Array([4, 5, 6]).buffer;
    expect(exactArrayBuffer(bytes)).toBe(bytes);
  });
});
