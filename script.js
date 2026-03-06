// Interactive demo counter
let clickCount = 0;

// Array of random background colours for the demo box
const colours = [
  { bg: '#e8f0fe', text: '#1a73e8' },
  { bg: '#fce8e2', text: '#c5221f' },
  { bg: '#e6f4ea', text: '#188038' },
  { bg: '#fef7e0', text: '#9a7c00' },
  { bg: '#f3e8fd', text: '#8430ce' },
];
let colourIndex = 0;

const demoBox = document.getElementById('demo-box');

// Change the colour of the demo box
document.getElementById('btn-color').addEventListener('click', function () {
  colourIndex = (colourIndex + 1) % colours.length;
  const { bg, text } = colours[colourIndex];
  demoBox.style.background = bg;
  demoBox.style.color = text;
  demoBox.textContent = 'Цветът се промени! 🎨';
});

// Show a greeting alert
document.getElementById('btn-alert').addEventListener('click', function () {
  const name = prompt('Как се казваш?', 'Ученик');
  if (name) {
    demoBox.textContent = `Здравей, ${name}! 👋`;
  }
});

// Count button clicks
document.getElementById('btn-count').addEventListener('click', function () {
  clickCount++;
  demoBox.textContent = `Брой кликвания: ${clickCount} 🖱️`;
});
