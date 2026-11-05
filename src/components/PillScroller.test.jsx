import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PillScroller from './PillScroller';

const originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

function setSize({ scrollWidth, clientWidth }) {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get: () => scrollWidth,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => clientWidth,
  });
}

describe('PillScroller', () => {
  beforeEach(() => {
    setSize({ scrollWidth: 600, clientWidth: 300 });
    HTMLElement.prototype.scrollBy = vi.fn();
    HTMLElement.prototype.scrollTo = vi.fn();
  });

  afterEach(() => {
    if (originalScrollWidth) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', originalScrollWidth);
    else delete HTMLElement.prototype.scrollWidth;
    if (originalClientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
    else delete HTMLElement.prototype.clientWidth;
    delete HTMLElement.prototype.scrollBy;
    delete HTMLElement.prototype.scrollTo;
  });

  it('muestra la flecha para ver más categorías y desplaza la fila', async () => {
    render(
      <PillScroller activeKey="Todas">
        <button type="button" aria-pressed="true">Todas</button>
        <button type="button" aria-pressed="false">Cervezas</button>
      </PillScroller>
    );

    expect(screen.queryByLabelText('Ver categorías anteriores')).toBeNull();
    const next = await screen.findByLabelText('Ver más categorías');
    fireEvent.click(next);

    expect(HTMLElement.prototype.scrollBy).toHaveBeenCalledWith({
      left: 210,
      behavior: 'smooth',
    });
  });

  it('oculta las flechas cuando todas las categorías caben en pantalla', () => {
    setSize({ scrollWidth: 300, clientWidth: 300 });

    render(
      <PillScroller activeKey="Todas">
        <button type="button" aria-pressed="true">Todas</button>
      </PillScroller>
    );

    expect(screen.queryByLabelText('Ver categorías anteriores')).toBeNull();
    expect(screen.queryByLabelText('Ver más categorías')).toBeNull();
  });
});
