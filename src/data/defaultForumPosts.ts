import { ForumPost } from '../types/help';

export const INITIAL_FORUM_POSTS: ForumPost[] = [
  {
    id: 'post-1',
    title: 'SG90 Micro Servo jittering and vibrating violently on Arduino Pin 11',
    content:
      'I connected the signal wire of my SG90 servo to Pin 11 on the CNC Shield V3 (using the Z+ endstop header with GRBL 1.1f). As soon as the stepper motors energize, the servo arm starts twitching and getting warm. How do I stop the jitter?',
    category: 'Servo & Pen Lift',
    tags: ['SG90', 'Pin11', 'Servo', 'PWM', 'Jitter', 'Power'],
    author: 'Alex_PlotterDev',
    createdAt: '2 hours ago',
    upvotes: 24,
    downvotes: 1,
    userVote: null,
    isSolved: true,
    codeSnippet: '$32=0\n$30=1000\n$31=0\nM3 S0   ; Pen UP\nM3 S90  ; Pen DOWN',
    comments: [
      {
        id: 'c-1',
        postId: 'post-1',
        author: 'Marcus_CNC_Guru',
        authorRole: 'Plotter Engineer',
        content:
          '99% of the time this is caused by sharing the 5V power rail from the Arduino Uno onboard regulator. The Uno cannot supply enough peak current (500mA - 800mA stall) when the servo moves, causing brownout voltage drops and erratic PWM.\n\nFix: Power the servo Red (+) wire from an external dedicated 5V 2A buck converter or separate 5V supply. Make sure the ground (Black/Brown wire) is connected to Arduino GND for common reference.',
        createdAt: '1 hour ago',
        upvotes: 18,
        downvotes: 0,
        userVote: null,
      },
      {
        id: 'c-2',
        postId: 'post-1',
        author: 'Alex_PlotterDev',
        content:
          'Adding a separate 5V 2A supply with common ground completely resolved it! The servo is now dead silent when parked at M5 / M3 S0.',
        createdAt: '30 mins ago',
        upvotes: 7,
        downvotes: 0,
        userVote: null,
      },
    ],
  },
  {
    id: 'post-2',
    title: 'Dual Y-axis stepper motors moving in opposite directions on CNC Shield V3',
    content:
      'My machine uses 2 stepper motors on the Y-axis. I installed jumpers on the A-axis clone headers set to Y. However, when I jog Y+ in the controller, the left motor spins clockwise and the right motor spins counter-clockwise, twisting the gantry. What is the cleanest fix?',
    category: 'Dual-Y Steppers',
    tags: ['Dual-Y', 'CNC-Shield-V3', 'A-Axis', 'Wiring', 'Steppers'],
    author: 'ElenaR_Maker',
    createdAt: '5 hours ago',
    upvotes: 31,
    downvotes: 0,
    userVote: null,
    isSolved: true,
    comments: [
      {
        id: 'c-3',
        postId: 'post-2',
        author: 'PlotterCraft_Official',
        authorRole: 'Core Team',
        content:
          'Turn off the 12V/24V power supply first! Then take the 4-pin DuPont connector for ONE of the Y motors and flip it 180 degrees before plugging it back in.\n\nFlipping the plug reverses the coil phase polarity, causing that specific motor to rotate in reverse, bringing both Y motors into perfect forward/reverse unison.',
        createdAt: '4 hours ago',
        upvotes: 22,
        downvotes: 0,
        userVote: null,
      },
    ],
  },
  {
    id: 'post-3',
    title: 'Calibrating $100 and $101 steps/mm for 500x500mm bed with 16-tooth vs 20-tooth GT2 pulleys',
    content:
      'I am building the 500x500mm square bed setup. My NEMA 17 motors are 1.8 degree (200 steps/rev) and my A4988 drivers have all 3 jumpers installed underneath (1/16 microstepping). What are the exact values to put in GRBL for 16-tooth vs 20-tooth pulleys?',
    category: 'GRBL & Firmware',
    tags: ['Steps/mm', '$100', '$101', 'GT2', 'A4988', '500x500'],
    author: 'SamK_Robotics',
    createdAt: '1 day ago',
    upvotes: 19,
    downvotes: 1,
    userVote: null,
    isSolved: true,
    codeSnippet: '; Formula: (200 steps * 16 microsteps) / (teeth * 2mm pitch)\n; For 16T pulley:\n$100=100.000\n$101=100.000\n\n; For 20T pulley (Standard default in PlotterCraft):\n$100=80.000\n$101=80.000',
    comments: [
      {
        id: 'c-4',
        postId: 'post-3',
        author: 'David_VectorLab',
        content:
          'Also remember to set your max travel limits so GRBL knows you have a 500x500mm envelope:\n$130=500.000 (X max travel)\n$131=500.000 (Y max travel)\nWorks like a charm!',
        createdAt: '18 hours ago',
        upvotes: 12,
        downvotes: 0,
        userVote: null,
      },
    ],
  },
  {
    id: 'post-4',
    title: 'How does the new Single-Line Centerline Thinning mode work on thick letters and logos?',
    content:
      'I noticed the new toggle in the Potato/Low/Medium modes for Single-Line Centerline & Shrunk Mode. When should I turn this on vs using standard contour vectorization?',
    category: 'G-Code & Slicing',
    tags: ['Single-Line', 'Thinning', 'Skeleton', 'Potato', 'Lettering'],
    author: 'ZoeArtisan',
    createdAt: '3 days ago',
    upvotes: 15,
    downvotes: 0,
    userVote: null,
    isSolved: true,
    comments: [
      {
        id: 'c-5',
        postId: 'post-4',
        author: 'PlotterCraft_Official',
        authorRole: 'Core Team',
        content:
          'Standard contouring traces BOTH outer boundaries of a thick black stroke, which produces double lines with white space in between unless you hatch them.\n\nSingle-Line Centerline uses the Zhang-Suen morphological thinning algorithm to collapse thick shapes into a 1-pixel skeleton medial axis. This gives you a fast, elegant single pen stroke per line (ideal for signatures, lettering, calligraphy, and minimalist line art) and scales the image down (default 65%) right in the center of the 500x500 bed for quick testing.',
        createdAt: '2 days ago',
        upvotes: 14,
        downvotes: 0,
        userVote: null,
      },
    ],
  },
];
