import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, repoData, profileData } = await req.json();

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "repo-summary") {
      systemPrompt = `You are a technical expert that provides concise, insightful summaries of GitHub repositories. 
Focus on:
- What the project does (purpose)
- Key technologies used
- Notable features or architecture
- Who would benefit from using it
Keep the summary brief (2-3 paragraphs max), engaging, and technical but accessible.`;

      userPrompt = `Summarize this GitHub repository:
Name: ${repoData.name}
Description: ${repoData.description || "No description provided"}
Language: ${repoData.language || "Not specified"}
Stars: ${repoData.stargazers_count}
Forks: ${repoData.forks_count}
Topics: ${repoData.topics?.join(", ") || "None"}
License: ${repoData.license?.name || "Not specified"}
Last Updated: ${repoData.updated_at}`;
    } else if (type === "profile-summary") {
      const repoList = profileData.repositories
        .slice(0, 20)
        .map((r: any) =>
          `- ${r.name}: ${r.description || "No description"} (${r.language || "Unknown"}, ★${r.stargazers_count})`
        )
        .join("\n");

      const languages = [
        ...new Set(
          profileData.repositories.map((r: any) => r.language).filter(Boolean),
        ),
      ];
      const totalStars = profileData.repositories.reduce(
        (sum: number, r: any) => sum + r.stargazers_count,
        0,
      );

      systemPrompt = `You are a technical analyst that provides insightful profiles of developers based on their GitHub activity.
Create a brief but comprehensive overview that covers:
- Primary areas of expertise
- Technology stack preferences  
- Types of projects they work on
- Notable achievements or patterns
Keep it professional, concise (2-3 paragraphs), and insightful.`;

      userPrompt = `Analyze this GitHub developer profile:
Username: ${profileData.user.login}
Name: ${profileData.user.name || "Not provided"}
Bio: ${profileData.user.bio || "No bio"}
Public Repos: ${profileData.user.public_repos}
Followers: ${profileData.user.followers}
Total Stars: ${totalStars}
Languages Used: ${languages.join(", ")}

Top Repositories:
${repoList}`;
    } else {
      throw new Error("Invalid request type");
    }

    console.log(`Processing ${type} request with Groq`);

    // 🔹 Call Groq Chat Completions API
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // or another Groq model you like
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error("Groq API error:", groqResponse.status, errorText);

      return new Response(
        JSON.stringify({
          error: "Groq API error",
          status: groqResponse.status,
          details: errorText,
        }),
        {
          status: groqResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await groqResponse.json();
    const summary =
      data.choices?.[0]?.message?.content || "Unable to generate summary.";

    console.log(`Successfully generated ${type} with Groq`);

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in summarize-repo function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
