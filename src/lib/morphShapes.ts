/**
 * A journey of 6 shapes for the splash's morph sequence: what you track, then the app itself.
 * Each is a SINGLE closed SVG contour (no holes, no compound paths) in a shared 0 0 200 200
 * viewBox, sized and centered consistently — flubber's shape interpolation reads cleanest when
 * successive shapes have comparable scale and position, even though it can handle arbitrary
 * point counts on either side.
 */
export interface MorphShape {
  id: string
  label: string
  color: string
  d: string
}

export const MORPH_SHAPES: MorphShape[] = [
  {
    id: 'apple',
    label: 'apple',
    color: '#ff6b6b',
    d: 'M100,180 C64,180 34,152 34,114 C34,86 50,64 74,54 C71,44 74,32 84,24 C87,32 87,40 84,48 C89,45 94,44 100,44 C136,44 166,74 166,114 C166,152 136,180 100,180 Z',
  },
  {
    id: 'bowl',
    label: 'bowl',
    color: '#ffb800',
    d: 'M28,90 C28,78 45,70 66,66 C76,58 88,54 100,54 C112,54 124,58 134,66 C155,70 172,78 172,90 C172,92 171,94 170,96 C165,130 137,158 100,158 C63,158 35,130 30,96 C29,94 28,92 28,90 Z',
  },
  {
    id: 'dumbbell',
    label: 'dumbbell',
    color: '#8b5cf6',
    d: 'M66,60 L44,60 C30,60 20,70 20,84 L20,116 C20,130 30,140 44,140 L66,140 C74,140 80,134 80,126 L80,108 L120,108 L120,126 C120,134 126,140 134,140 L156,140 C170,140 180,130 180,116 L180,84 C180,70 170,60 156,60 L134,60 C126,60 120,66 120,74 L120,92 L80,92 L80,74 C80,66 74,60 66,60 Z',
  },
  {
    id: 'scale',
    label: 'scale',
    color: '#10d8ff',
    d: 'M48,96 L80,96 C82,86 90,80 100,80 C110,80 118,86 120,96 L152,96 C162,96 170,104 170,114 L170,142 C170,152 162,160 152,160 L48,160 C38,160 30,152 30,142 L30,114 C30,104 38,96 48,96 Z',
  },
  {
    id: 'core',
    label: 'core',
    color: '#00e5a0',
    d: 'M100,42 C132.03,42 158,67.97 158,100 C158,132.03 132.03,158 100,158 C67.97,158 42,132.03 42,100 C42,67.97 67.97,42 100,42 Z',
  },
]
