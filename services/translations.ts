import { AnalysisResult, PiResponse } from '../types';

/**
 * MOCK SERVICE FOR RASPBERRY PI INTEGRATION
 * 
 * In a real deployment, you would replace the URL below with your Pi's IP address.
 * Example: const PI_API_URL = 'http://192.168.1.105:5000/analyze';
 */

// Simulated delay to mimic network request
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const analyzeImageWithPi = async (imageBase64: string): Promise<AnalysisResult> => {
  console.log("Sending image to Raspberry Pi for analysis...");

  // --- REAL IMPLEMENTATION EXAMPLE ---
  /*
  try {
    const response = await fetch('http://YOUR_RASPBERRY_PI_IP:8000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64 })
    });
    const data: PiResponse = await response.json();
    if (!data.success) throw new Error(data.error);
    
    return {
      id: Date.now().toString(),
      imageUrl: imageBase64, // Or the URL returned by the server
      timestamp: new Date().toISOString(),
      bacteriaType: data.data.identified_bacteria,
      confidence: data.data.confidence_score,
      status: 'completed',
      notes: 'Analysis received from Pi unit.'
    };
  } catch (error) {
    console.error("Pi Connection Failed", error);
    // Return failed state
    return {
        id: Date.now().toString(),
        imageUrl: imageBase64,
        timestamp: new Date().toISOString(),
        bacteriaType: 'Unknown',
        confidence: 0,
        notes: error.message,
        status: 'failed'
    }
  }
  */
  // -----------------------------------

  // --- MOCK IMPLEMENTATION (For Demo) ---
  await delay(1500 + Math.random() * 1000); // Wait 1.5-2.5 seconds

  // 10% chance of failure for demo purposes
  if (Math.random() < 0.1) {
    return {
      id: Date.now().toString(),
      imageUrl: imageBase64,
      timestamp: new Date().toISOString(),
      bacteriaType: 'Analysis Failed',
      confidence: 0,
      notes: 'Connection timeout or sensor error',
      status: 'failed'
    };
  }

  // 5% chance of pending (maybe requires manual review)
  if (Math.random() < 0.05) {
     return {
      id: Date.now().toString(),
      imageUrl: imageBase64,
      timestamp: new Date().toISOString(),
      bacteriaType: 'Pending Review',
      confidence: 0,
      notes: 'Low confidence score, requires manual verification',
      status: 'pending'
    };
  }

  // Randomize result for demonstration
  const bacteriaTypes = ['Staphylococcus aureus', 'E. coli', 'Salmonella', 'Streptococcus', 'Lactobacillus'];
  const randomBacteria = bacteriaTypes[Math.floor(Math.random() * bacteriaTypes.length)];
  const randomConfidence = (Math.random() * (99.9 - 85.0) + 85.0).toFixed(1);

  return {
    id: Date.now().toString(),
    imageUrl: imageBase64,
    timestamp: new Date().toISOString(),
    bacteriaType: randomBacteria,
    confidence: parseFloat(randomConfidence),
    notes: 'Automated Pi Analysis',
    status: 'completed'
  };
};
