// Hauptkomponente der Pflanzenpflege-Tracker-Anwendung
const { useState, useEffect } = React;

// API-Schlüssel (UNSIICHER: Nur für Studienzwecke direkt eingebunden)
// Diese Schlüssel sollten in einer sicheren Umgebung (z. B. .env-Datei) gespeichert werden
const PLANT_ID_API_KEY = "avlFysladevX0qUnsIM9nkHsyVQOUH2ZuwY9rbJlco9f1qbkzK"; // Plant.id API-Schlüssel
const WEATHER_API_KEY = "3bde2f18e956eb6065fb6c19f326ff73"; // OpenWeatherMap API-Schlüssel
const CALENDAR_API_KEY = "AIzaSyBapxYGGpoXoPGsbWECIkGmLuRgRHUIlP0"; // Google Calendar API-Schlüssel

// Debugging: Überprüfe, ob React geladen ist
// Diese Logs helfen bei der Fehlersuche, falls die Bibliotheken nicht korrekt geladen werden
console.log("React geladen:", typeof React !== "undefined");
console.log("ReactDOM geladen:", typeof ReactDOM !== "undefined");

// Hauptkomponente
const PlantTracker = () => {
  // Zustände für Pflanzen, neue Pflanze, Wetter, Benachrichtigungen und Fehler
  // useState verwaltet die Daten im React-Komponentenbaum
  const [plants, setPlants] = useState([]); // Liste der aktuellen Pflanzen, initial leer
  const [newPlant, setNewPlant] = useState({ name: "", image: null }); // Daten für eine neue Pflanze
  const [weather, setWeather] = useState(null); // Aktuelle Wetterinformationen
  const [notifications, setNotifications] = useState(() => {
    // Lädt Benachrichtigungen aus localStorage beim Initialisieren
    const savedNotifications = localStorage.getItem("notifications");
    return savedNotifications ? JSON.parse(savedNotifications) : [];
  }); // Liste der Benachrichtigungen
  const [error, setError] = useState(null); // Speichert Fehlermeldungen für die UI

  // Benachrichtigungen im localStorage speichern, wenn sie sich ändern
  // useEffect sorgt für persistente Speicherung der Benachrichtigungen
  useEffect(() => {
    localStorage.setItem("notifications", JSON.stringify(notifications));
    console.log("Benachrichtigungen im localStorage gespeichert:", notifications);
  }, [notifications]); // Abhängigkeit: notifications

  // Funktion zum Hinzufügen einer neuen Pflanze
  // Verhindert Hinzufügung, wenn Name oder Bild fehlen
  const addPlant = async (e) => {
    e.preventDefault(); // Verhindert das Standard-Formularverhalten (Seitenrefresh)
    if (!newPlant.name || !newPlant.image) {
      setError("Bitte gib einen Namen und ein Bild ein."); // Setzt Fehlermeldung
      console.warn("Fehlende Eingaben: Name oder Bild", { name: newPlant.name, image: newPlant.image });
      return; // Abbruch bei unvollständigen Daten
    }

    try {
      console.log("Starte Plant.id API-Aufruf mit Bild:", newPlant.image.name);
      const identifiedPlant = await identifyPlant(newPlant.image); // Ruft Pflanzenidentifikation auf
      const plantData = {
        id: plants.length + 1, // Erzeugt eine neue eindeutige ID
        name: newPlant.name,
        species: identifiedPlant?.species || "Unbekannt (API fehlgeschlagen)", // Fallback bei fehlender Spezies
        lastWatered: new Date().toISOString().split("T")[0], // Aktuelles Datum
        wateringInterval: identifiedPlant?.wateringInterval || 7, // Standardwert für Gießintervall
        repottingInterval: identifiedPlant?.repottingInterval || 365, // Standardwert für Umtopfintervall
      };

      setPlants([...plants, plantData]); // Fügt die neue Pflanze zur Liste hinzu
      setNewPlant({ name: "", image: null }); // Zurücksetzen des Eingabefelds
      setError(null); // Zurücksetzen der Fehlermeldung
      console.log("Pflanze hinzugefügt:", plantData);

      // Kalender-API: Erinnerung erstellen
      await scheduleNotification(plantData); // Planung der Benachrichtigung
    } catch (err) {
      setError(`Fehler beim Hinzufügen der Pflanze: ${err.message}`); // Setzt Fehlermeldung
      console.error("Fehler beim Pflanzen hinzufügen:", err);
      // Fallback nur für andere Fehler als "Übereinstimmung unter 10%"
      if (!err.message.includes("Erkennung zu unsicher: Übereinstimmung unter 10%")) {
        const fallbackPlant = {
          id: plants.length + 1,
          name: newPlant.name,
          species: "Unbekannt (API fehlgeschlagen)",
          lastWatered: new Date().toISOString().split("T")[0],
          wateringInterval: 7,
          repottingInterval: 365,
        };
        setPlants([...plants, fallbackPlant]); // Fügt Fallback-Pflanze hinzu
        setNewPlant({ name: "", image: null });
        console.log("Fallback-Pflanze hinzugefügt:", fallbackPlant);
      }
    }
  };

  // Pflanzenidentifikation mit Plant.id API
  // Verarbeitet das Hochgeladene Bild und gibt Pflanzendaten zurück
  const identifyPlant = async (image) => {
    try {
      // Validierung des Bildes
      if (!image || !image.type.match(/image\/(jpeg|png)/)) {
        throw new Error("Ungültiges Bildformat. Bitte lade ein JPG- oder PNG-Bild hoch.");
      }

      const formData = new FormData();
      formData.append("images", image); // Hängt das Bild an die Formulardaten an
      formData.append("api_key", PLANT_ID_API_KEY); // Fügt den API-Schlüssel hinzu
      formData.append("plant_details[]", ["common_names", "care"]); // Fordert spezifische Details an

      console.log("FormData vorbereitet:", {
        imageName: image.name,
        imageType: image.type,
        apiKey: PLANT_ID_API_KEY.substring(0, 5) + "...", // Teilweise maskierter API-Schlüssel
        plantDetails: ["common_names", "care"],
      });

      const response = await fetch("https://api.plant.id/v2/identify", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Plant.id API Fehler: ${response.statusText} - ${errorText || "Keine Details"}`);
      }

      const data = await response.json();
      console.log("Plant.id Antwort:", data);

      // Überprüfe die Übereinstimmung (probability)
      const probability = data.suggestions[0]?.probability || 0; // Fallback auf 0, wenn keine Wahrscheinlichkeit vorhanden
      if (probability < 0.1) {
        throw new Error("Erkennung zu unsicher: Übereinstimmung unter 10%. Bitte lade ein klareres Bild hoch.");
      }

      return {
        species: data.suggestions[0]?.plant_name || "Unbekannt", // Erste Suggestion oder Fallback
        wateringInterval: data.suggestions[0]?.plant_details?.care?.watering?.interval_days || 7,
        repottingInterval: data.suggestions[0]?.plant_details?.care?.repotting?.interval_days || 365,
      };
    } catch (err) {
      console.error("Plant.id Fehler:", err);
      throw err; // Weiterleitung des Fehlers an die aufrufende Funktion
    }
  };

  // Wetterdaten mit OpenWeatherMap API abrufen
  // Holt Wetterinformationen für einen Standardort (Berlin)
  const fetchWeather = async (location = "Berlin") => {
    try {
      console.log("Starte Wetter-API-Aufruf...");
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${WEATHER_API_KEY}&units=metric`
      );
      if (!response.ok) {
        throw new Error(`Wetter-API Fehler: ${response.statusText}`);
      }
      const data = await response.json();
      setWeather({ condition: data.weather[0].main, temp: data.main.temp }); // Speichert Wetterdaten
      console.log("Wetterdaten geladen:", data);
    } catch (err) {
      console.error("Wetter-API Fehler:", err);
      setError("Fehler beim Abrufen der Wetterdaten: " + err.message);
      setWeather({ condition: "Sonnig", temp: 20 }); // Fallback-Wetterdaten
      console.log("Wetterdaten Fallback verwendet");
    }
  };

  // Kalender-API für Benachrichtigungen (Mock, da OAuth2 erforderlich)
  // Erstellt eine Mock-Benachrichtigung basierend auf dem Gießintervall
  const scheduleNotification = async (plant) => {
    try {
      const nextWatering = new Date(plant.lastWatered);
      nextWatering.setDate(nextWatering.getDate() + plant.wateringInterval); // Berechnet das nächste Gießdatum

      const event = {
        summary: `Gieße ${plant.name}`,
        start: { date: nextWatering.toISOString().split("T")[0] },
        end: { date: nextWatering.toISOString().split("T")[0] },
      };
      console.log("Kalender-API: Erstelle Ereignis (Mock):", event);

      setNotifications([...notifications, `Gieße ${plant.name} am ${nextWatering.toLocaleDateString()}`]);
      console.log("Benachrichtigung hinzugefügt:", notifications);
    } catch (err) {
      console.error("Kalender-API Fehler:", err);
      throw err;
    }
  };

  // Funktion zum Löschen einer einzelnen Erinnerung und der zugehörigen Pflanze
  // Entfernt sowohl die Benachrichtigung als auch die Pflanze basierend auf dem Namen
  const removeNotification = (index) => {
    const notification = notifications[index];
    const plantName = notification.split(" ")[1]; // Extrahiert den Pflanzennamen aus der Benachrichtigung
    const newPlants = plants.filter((plant) => plant.name !== plantName); // Filtert die Pflanze heraus
    const newNotifications = notifications.filter((_, i) => i !== index); // Entfernt die Benachrichtigung

    setPlants(newPlants);
    setNotifications(newNotifications);
    localStorage.setItem("notifications", JSON.stringify(newNotifications)); // Aktualisiert localStorage
    console.log("Einzelne Benachrichtigung und Pflanze gelöscht:", { plantName, index });
  };

  // Funktion zum Löschen aller Erinnerungen
  // Entfernt alle Benachrichtigungen und löscht sie aus localStorage
  const clearNotifications = () => {
    setNotifications([]);
    localStorage.removeItem("notifications");
    console.log("Alle Benachrichtigungen gelöscht");
  };

  // Wetter beim Laden abrufen
  // useEffect sorgt dafür, dass Wetterdaten beim Mounten der Komponente geladen werden
  useEffect(() => {
    console.log("Lade Wetterdaten beim Start...");
    fetchWeather();
  }, []); // Keine Abhängigkeiten, lädt nur einmal beim Start

  // Datei-Upload-Handler für normales Hochladen
  // Verarbeitet das Hochladen eines Bildes über Dateiauswahl
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.match(/image\/(jpeg|png)/)) {
        setError("Ungültiges Bildformat. Bitte lade ein JPG- oder PNG-Bild hoch.");
        setNewPlant({ ...newPlant, image: null });
        console.warn("Ungültiges Bildformat:", file.type);
        return; // Abbruch bei ungültigem Format
      }
      setNewPlant({ ...newPlant, image: file }); // Setzt das hochgeladene Bild
      console.log("Bild ausgewählt (Upload):", file.name, file.type);
    } else {
      console.warn("Kein Bild ausgewählt (Upload)");
    }
  };

  // Datenverknüpfung: Gießintervall basierend auf Wetter anpassen
  // Passt das Gießintervall an die Wetterbedingungen an
  const adjustWateringInterval = (interval, weather) => {
    if (!weather) return interval; // Keine Anpassung, wenn keine Wetterdaten vorhanden
    if (weather.temp > 25) return interval - 1; // Reduziert Intervall bei Hitze
    if (weather.condition === "Rain") return interval + 1; // Erhöht Intervall bei Regen
    return interval; // Standardintervall, wenn keine besonderen Bedingungen
  };

  // Debugging: Überprüfe, ob die Komponente rendert
  console.log("Render PlantTracker Komponente...");
  console.log("Aktuelle Pflanzen:", plants);
  console.log("Aktuelles Wetter:", weather);
  console.log("Aktuelle Benachrichtigungen:", notifications);

  // Rendern der Benutzeroberfläche
  return (
    <div className="min-h-screen bg-gradient-to-r from-green-50 to-blue-50 p-4">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-green-800 mb-6">Virtueller Pflanzenpflege-Tracker</h1>
        
        {/* Fehleranzeige */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 rounded-lg shadow-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Wetteranzeige */}
        <div className="mb-6 p-4 bg-blue-100 rounded-lg shadow-md weather-card">
          {weather ? (
            <>
              <p className="text-blue-800">Wetter: {weather.condition}, {weather.temp}°C</p>
              <p className="text-blue-600">{weather.condition === "Sonnig" ? "Perfekt für deine Pflanzen!" : "Achte auf die Bewässerung."}</p>
            </>
          ) : (
            <p className="text-blue-800">Wetterdaten werden geladen oder sind nicht verfügbar...</p>
          )}
        </div>

        {/* Formular zum Hinzufügen einer Pflanze */}
        <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-green-800 mb-4">Neue Pflanze hinzufügen</h2>
          <div className="space-y-4">
            <input
              type="text"
              value={newPlant.name}
              onChange={(e) => setNewPlant({ ...newPlant, name: e.target.value })}
              placeholder="Pflanzenname"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <div>
              <label className="block text-gray-600 mb-2">Bild hochladen:</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                className="w-full p-2 text-gray-600"
              />
            </div>
            <button
              onClick={addPlant}
              className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-300"
            >
              Pflanze hinzufügen
            </button>
          </div>
        </div>

        {/* Pflanzenübersicht */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {plants.length > 0 ? (
            plants.map((plant) => (
              <div key={plant.id} className="p-4 bg-white rounded-lg shadow-md plant-card">
                <h3 className="text-lg font-semibold text-green-800">{plant.name} ({plant.species})</h3>
                <p className="text-gray-600">Zuletzt gegossen: {plant.lastWatered}</p>
                <p className="text-gray-600">Nächstes Gießen: In {adjustWateringInterval(plant.wateringInterval, weather)} Tagen</p>
                <p className="text-gray-600">Umtopfen: Alle {plant.repottingInterval} Tage</p>
              </div>
            ))
          ) : (
            <p className="text-gray-600">Keine Pflanzen hinzugefügt.</p>
          )}
        </div>

        {/* Benachrichtigungen */}
        {notifications.length > 0 && (
          <div className="mt-8 p-6 bg-yellow-100 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-yellow-800">Erinnerungen</h2>
              <button
                onClick={clearNotifications}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition duration-300"
              >
                Alle löschen
              </button>
            </div>
            <ul className="list-disc pl-5 text-yellow-700 space-y-2">
              {notifications.map((note, index) => (
                <li key={index} className="flex justify-between items-center">
                  <span>{note}</span>
                  <button
                    onClick={() => removeNotification(index)}
                    className="ml-4 bg-red-500 text-white px-2 py-1 rounded-lg hover:bg-red-600 transition duration-300"
                  >
                    Löschen
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

// Rendern der App
// Versucht, die React-Komponente im DOM zu rendern
try {
  console.log("Versuche, React App zu rendern...");
  if (document.getElementById("root")) {
    ReactDOM.render(<PlantTracker />, document.getElementById("root"));
    console.log("React App erfolgreich gerendert");
  } else {
    console.error("Fehler: #root-Element nicht gefunden in index.html");
  }
} catch (err) {
  console.error("Fehler beim Rendern der React App:", err);
}