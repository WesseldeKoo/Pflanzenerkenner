const express = require('express');
const dotenv = require('dotenv');
const fetch = require('node-fetch');
const FormData = require('form-data');
const app = express();

dotenv.config();
const PORT = process.env.PORT || 3000;
const PLANT_ID_API_KEY = process.env.PLANT_ID_API_KEY;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/api/identify-plant', async (req, res) => {
  try {
    const { image } = req.body; // Annahme: Bild als Base64 oder Datei
    const formData = new FormData();
    formData.append('images', Buffer.from(image), { filename: 'image.jpg' });
    formData.append('api_key', PLANT_ID_API_KEY);
    formData.append('plant_details', ['common_names', 'care']);

    const response = await fetch('https://api.plant.id/v2/identify', {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    res.json({
      species: data.suggestions[0]?.plant_name || 'Unbekannt',
      wateringInterval: data.suggestions[0]?.plant_details?.care?.watering?.interval_days || 7,
      repottingInterval: data.suggestions[0]?.plant_details?.care?.repotting?.interval_days || 365,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));