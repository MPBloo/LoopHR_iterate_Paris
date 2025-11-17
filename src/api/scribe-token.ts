// API endpoint pour générer des tokens ElevenLabs single-use
// À déployer comme une fonction serverless ou un endpoint API

export async function POST(request: Request) {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ElevenLabs API key not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const response = await fetch(
      "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify({ token: data.token }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating token:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate token" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
