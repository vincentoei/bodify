"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Help</h1>
      <Card>
        <CardHeader>
          <CardTitle>About Bodify</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Bodify is a decision-support tool, not medical advice. Always follow the
            guidance of your healthcare provider.
          </p>
          <p>
            Use the microphone button to speak to Bodify anywhere in the app.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
