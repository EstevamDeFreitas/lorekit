import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import {
  CLOUD_BLOB_REQUEST_SPACING_MS,
  CloudTransferPacerService,
} from './cloud-transfer-pacer.service';

describe('CloudTransferPacerService', () => {
  it('spaces consecutive blob requests', fakeAsync(() => {
    const pacer = new CloudTransferPacerService();
    let firstCompleted = false;
    let secondCompleted = false;

    void pacer.waitForTurn().then(() => { firstCompleted = true; });
    flushMicrotasks();
    expect(firstCompleted).toBeTrue();

    void pacer.waitForTurn().then(() => { secondCompleted = true; });
    flushMicrotasks();
    expect(secondCompleted).toBeFalse();

    tick(CLOUD_BLOB_REQUEST_SPACING_MS - 1);
    expect(secondCompleted).toBeFalse();
    tick(1);
    flushMicrotasks();
    expect(secondCompleted).toBeTrue();
  }));
});
