import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, BaseRouteReuseStrategy } from '@angular/router';

/**
 * Angular reuses a component when only route params change. A board page owns a per-board
 * session (Y.Doc, sync, undo…) provided in its injector, so switching boards must create a
 * fresh component — and a fresh session.
 */
@Injectable()
export class BoardRouteReuseStrategy extends BaseRouteReuseStrategy {
  override shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig && future.paramMap.get('boardId') === curr.paramMap.get('boardId');
  }
}
