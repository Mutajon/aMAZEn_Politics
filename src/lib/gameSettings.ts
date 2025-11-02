
export const fetchAndStoreGameSettings = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const researcherId = urlParams.get('rid') || '12';

  try {
    const response = await fetch(`https://democracygame-backend.onrender.com/api/gameSettings/getGameSettings?researcherId=${researcherId}`);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const settings = await response.json();
    if (settings.success) {
      localStorage.setItem('gameSettings', JSON.stringify(settings.data));
      console.log('Game settings stored in localStorage:', settings.data);
    } else {
      console.error('Failed to fetch game settings:', settings.message);
    }
  } catch (error) {
    console.error('Error fetching or storing game settings:', error);
  }
};
