
export const LANGUAGES = {
  javascript: { name: 'JavaScript', extension: 'js', icon: '🟨' },
  typescript: { name: 'TypeScript', extension: 'ts', icon: '🔷' },
  python: { name: 'Python', extension: 'py', icon: '🐍' },
  java: { name: 'Java', extension: 'java', icon: '☕' },
  cpp: { name: 'C++', extension: 'cpp', icon: '⚡' },
  c: { name: 'C', extension: 'c', icon: '🔧' }
};

export const DEFAULT_CODE_TEMPLATES = {
  javascript: '// JavaScript file\nconsole.log("Hello, World!");',
  typescript: '// TypeScript file\nconsole.log("Hello, World!");',
  python: '# Python file\nprint("Hello, World!")',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
  cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
  c: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}'
};

export const FILE_TYPES = {
  file: 'file',
  folder: 'folder'
};

export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  ROOM_JOINED: 'room-joined',
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  SEND_MESSAGE: 'send-message',
  NEW_MESSAGE: 'new-message',
  FILE_UPDATED: 'file-updated',
  FILE_CONTENT_CHANGE: 'file-content-change',
  CURSOR_POSITION: 'cursor-position',
  ERROR: 'error'
};