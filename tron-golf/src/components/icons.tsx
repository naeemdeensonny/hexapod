/**
 * Pixel icon family. Every icon is drawn on the same 8x8 grid with square
 * pixels so they stay visually consistent at any size.
 */
type IconProps = { size?: number; color?: string };

const px = (x: number, y: number, w = 1, h = 1) => `M${x} ${y}h${w}v${h}h-${w}z`;

function Icon({ size = 16, color = 'currentColor', d }: IconProps & { d: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" fill={color} shapeRendering="crispEdges">
      <path d={d} />
    </svg>
  );
}

export const IconHome = (p: IconProps) => (
  <Icon {...p} d={[px(3, 0), px(2, 1), px(4, 1), px(1, 2), px(5, 2), px(0, 3, 8, 1), px(1, 4, 2, 4), px(5, 4, 2, 4), px(3, 5, 2, 3)].join(' ')} />
);

export const IconFlag = (p: IconProps) => (
  <Icon {...p} d={[px(2, 0, 1, 8), px(3, 0, 3, 1), px(3, 1, 3, 1), px(3, 2, 3, 1), px(1, 7, 5, 1)].join(' ')} />
);

export const IconCard = (p: IconProps) => (
  <Icon {...p} d={[px(0, 0, 8, 1), px(0, 7, 8, 1), px(0, 1, 1, 6), px(7, 1, 1, 6), px(2, 2, 4, 1), px(2, 4, 4, 1), px(2, 6, 3, 1)].join(' ')} />
);

export const IconHistory = (p: IconProps) => (
  <Icon {...p} d={[px(2, 0, 4, 1), px(1, 1, 1, 1), px(6, 1, 1, 1), px(0, 2, 1, 4), px(7, 2, 1, 4), px(1, 6, 1, 1), px(6, 6, 1, 1), px(2, 7, 4, 1), px(3, 2, 1, 3), px(4, 4, 2, 1)].join(' ')} />
);

export const IconGear = (p: IconProps) => (
  <Icon {...p} d={[px(3, 0, 2, 1), px(0, 3, 8, 2), px(3, 7, 2, 1), px(1, 1, 2, 1), px(5, 1, 2, 1), px(1, 6, 2, 1), px(5, 6, 2, 1), px(3, 2, 2, 4)].join(' ')} />
);

export const IconMap = (p: IconProps) => (
  <Icon {...p} d={[px(0, 1, 3, 6), px(3, 0, 2, 7), px(5, 1, 3, 6)].join(' ')} />
);

export const IconTarget = (p: IconProps) => (
  <Icon {...p} d={[px(3, 0, 2, 2), px(3, 6, 2, 2), px(0, 3, 2, 2), px(6, 3, 2, 2), px(3, 3, 2, 2)].join(' ')} />
);

export const IconPlus = (p: IconProps) => (
  <Icon {...p} d={[px(3, 1, 2, 6), px(1, 3, 6, 2)].join(' ')} />
);

export const IconChevron = (p: IconProps) => (
  <Icon {...p} d={[px(2, 0, 1, 2), px(3, 2, 1, 2), px(4, 3, 1, 2), px(3, 4, 1, 2), px(2, 6, 1, 2)].join(' ')} />
);
