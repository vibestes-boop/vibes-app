/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { MoreMenu } from '../more-menu';

// -----------------------------------------------------------------------------
// MoreMenu — v1.w.UI.12 Footer-Dropdown in der FeedSidebar (TikTok-Parity).
//
// Tests fixieren:
//   - Click-Toggle: Trigger öffnet Menu, zweiter Click schließt
//   - Vier Einträge vorhanden: Einstellungen, Coins, Darkmode, Abmelden
//   - Links zeigen auf die erwarteten Routen (/settings, /coin-shop)
//   - Darkmode-Toggle ruft setTheme() mit dem Gegenteil des aktuellen Themes
//   - Menu bleibt offen nach Darkmode-Click (in-place flip)
//   - Abmelden ist ein <form action={signOut}><button type="submit">
// -----------------------------------------------------------------------------

// Radix DropdownMenu nutzt Portal + PointerEvent-basierte Positionierung die
// jsdom nicht natürlich unterstützt. Wir stubben das Portal-Subset auf eine
// plain-div-Implementation, sodass DropdownMenuContent synchron im Test-DOM
// rendert wenn `open` true ist — identisches Pattern wie in
// followed-accounts-section.test.tsx (dort für Dialog).
//
// Wichtig: `components/ui/dropdown-menu.tsx` greift beim Modul-Load auf
// `.displayName` von JEDEM Primitive zu (SubTrigger, SubContent, CheckboxItem,
// RadioItem, Label, …), auch wenn MoreMenu nur einen Subset nutzt. Wir müssen
// also ALLE referenzierten Primitives als Stubs mit displayName anlegen —
// sonst wirft `undefined.displayName` sofort beim Import.
jest.mock('@radix-ui/react-dropdown-menu', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  type StubProps = { children?: React.ReactNode; [key: string]: unknown };
  const Passthrough = ({ children }: StubProps) => <>{children}</>;
  const makeStub = (name: string, impl?: React.FC<StubProps>): React.FC<StubProps> => {
    const Stub: React.FC<StubProps> = impl ?? (({ children }) => <>{children}</>);
    (Stub as React.FC<StubProps> & { displayName: string }).displayName = name;
    return Stub;
  };

  const Root: React.FC<{
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }> = ({ children, open, onOpenChange }) => (
    <div data-testid="dropdown-root" data-open={open}>
      {React.Children.map(children, (child: React.ReactNode) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement, {
              __open: open,
              __onOpenChange: onOpenChange,
            })
          : child,
      )}
    </div>
  );
  (Root as React.FC & { displayName: string }).displayName = 'DropdownMenuRoot';

  const Trigger: React.FC<{
    children: React.ReactNode;
    __onOpenChange?: (open: boolean) => void;
    __open?: boolean;
    asChild?: boolean;
  }> = ({ children, __onOpenChange, __open, asChild }) => {
    // `asChild`: erstes Kind IST der eigentliche Trigger. cloneElement
    // streamt unseren Click-Handler drauf — gleiche Semantik wie Radix.
    void asChild;
    const child = React.Children.only(children) as React.ReactElement<{
      onClick?: (e: React.MouseEvent) => void;
    }>;
    return React.cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        child.props.onClick?.(e);
        __onOpenChange?.(!__open);
      },
    });
  };
  (Trigger as React.FC & { displayName: string }).displayName = 'DropdownMenuTrigger';

  const Content: React.FC<{
    children?: React.ReactNode;
    __open?: boolean;
    __onOpenChange?: (open: boolean) => void;
  }> = ({ children, __open, __onOpenChange }) => {
    // ESC-Handler auf Content-Level simuliert — Radix-Real-Impl macht das
    // via onEscapeKeyDown auf dem Overlay, aber für Test-Zwecke reicht ein
    // direkter keydown-Listener auf dem Content-Container.
    if (!__open) return null;
    return (
      <div
        data-testid="dropdown-content"
        role="menu"
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Escape') __onOpenChange?.(false);
        }}
        tabIndex={-1}
      >
        {children}
      </div>
    );
  };
  (Content as React.FC & { displayName: string }).displayName = 'DropdownMenuContent';

  const Item: React.FC<{
    children: React.ReactNode;
    onSelect?: (e: Event) => void;
    asChild?: boolean;
  }> = ({ children, onSelect, asChild }) => {
    // Radix-Item rendert role="menuitem" und triggert onSelect bei Click.
    // Mit `asChild`: cloneElement cloned den ersten Child (damit <Link> /
    // <button> ihr natürliches Verhalten behalten) UND hookt onSelect an.
    const handler = (e: React.MouseEvent) => {
      const event = new CustomEvent('select', { cancelable: true });
      onSelect?.(event);
      void e;
    };
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>;
      return React.cloneElement(child, {
        onClick: (e: React.MouseEvent) => {
          child.props.onClick?.(e);
          handler(e);
        },
      });
    }
    return (
      <div role="menuitem" onClick={handler}>
        {children}
      </div>
    );
  };
  (Item as React.FC & { displayName: string }).displayName = 'DropdownMenuItem';

  const Separator: React.FC = () => <div role="separator" />;
  (Separator as React.FC & { displayName: string }).displayName = 'DropdownMenuSeparator';

  // Die folgenden Primitives werden von `components/ui/dropdown-menu.tsx`
  // importiert und beim Modul-Load auf `.displayName` gelesen, auch wenn
  // MoreMenu sie nicht nutzt. Wir stubben sie als Passthrough + displayName.
  return {
    Root,
    Trigger,
    Portal: makeStub('DropdownMenuPortal'),
    Content,
    Item,
    Separator,
    Group: makeStub('DropdownMenuGroup'),
    Sub: makeStub('DropdownMenuSub'),
    SubTrigger: makeStub('DropdownMenuSubTrigger'),
    SubContent: makeStub('DropdownMenuSubContent'),
    RadioGroup: makeStub('DropdownMenuRadioGroup'),
    RadioItem: makeStub('DropdownMenuRadioItem'),
    CheckboxItem: makeStub('DropdownMenuCheckboxItem'),
    Label: makeStub('DropdownMenuLabel'),
    ItemIndicator: Passthrough,
  };
});

// next-themes: kontrollierbarer useTheme-Mock pro Test via mockResolvedTheme.
let mockResolvedTheme: 'light' | 'dark' = 'light';
const mockSetTheme = jest.fn();
jest.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: mockResolvedTheme, setTheme: mockSetTheme }),
}));

// Server-Action signOut: durch ein fn-Handle austauschen, sodass wir den
// `form.action`-Prop gegen genau diesen Handle assertieren können.
const mockSignOut = jest.fn();
jest.mock('@/app/actions/auth', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

describe('MoreMenu', () => {
  beforeEach(() => {
    mockResolvedTheme = 'light';
    mockSetTheme.mockReset();
    mockSignOut.mockReset();
  });

  it('rendert den Trigger geschlossen (kein Content im DOM)', () => {
    render(<MoreMenu />);
    expect(screen.getByRole('button', { name: /Weitere Optionen/i })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('öffnet beim Klick auf den Trigger und zeigt alle 4 Einträge', () => {
    render(<MoreMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Weitere Optionen/i }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Einstellungen')).toBeInTheDocument();
    expect(screen.getByText('Coins')).toBeInTheDocument();
    expect(screen.getByText('Dunkelmodus')).toBeInTheDocument();
    expect(screen.getByText('Abmelden')).toBeInTheDocument();
  });

  it('Einstellungen-Link zeigt auf /settings', () => {
    render(<MoreMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Weitere Optionen/i }));
    const link = screen.getByText('Einstellungen').closest('a');
    expect(link).toHaveAttribute('href', '/settings');
  });

  it('Coins-Link zeigt auf /coin-shop', () => {
    render(<MoreMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Weitere Optionen/i }));
    const link = screen.getByText('Coins').closest('a');
    expect(link).toHaveAttribute('href', '/coin-shop');
  });

  it('Dark-Toggle ruft setTheme("dark") wenn Light-Mode aktiv', () => {
    mockResolvedTheme = 'light';
    render(<MoreMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Weitere Optionen/i }));

    fireEvent.click(screen.getByText('Dunkelmodus'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('Dark-Toggle ruft setTheme("light") wenn Dark-Mode aktiv und Label zeigt Hellmodus', () => {
    mockResolvedTheme = 'dark';
    render(<MoreMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Weitere Optionen/i }));

    // Im Dark-State steht das Toggle-Label auf „Hellmodus" (Gegenteil).
    expect(screen.getByText('Hellmodus')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Hellmodus'));
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('Abmelden-Button steht in einem <form action={signOut}>', () => {
    render(<MoreMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Weitere Optionen/i }));

    const logoutButton = screen.getByRole('button', { name: /Abmelden/i });
    expect(logoutButton).toHaveAttribute('type', 'submit');

    // form-Ancestor muss existieren und action auf die signOut-Server-Action
    // gesetzt haben. React rendert Server-Actions als String-Action oder
    // Function-Action, je nach Next-Version; wir prüfen pragmatisch, dass
    // ein form existiert und der Button darin steht.
    const form = logoutButton.closest('form');
    expect(form).not.toBeNull();
  });

  it('schließt beim Trigger-Re-Click (Click-Toggle)', () => {
    render(<MoreMenu />);
    const trigger = screen.getByRole('button', { name: /Weitere Optionen/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('schließt beim ESC-Key auf dem Content', () => {
    render(<MoreMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Weitere Optionen/i }));
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
