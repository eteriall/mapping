"use client";

import {
  ActivityIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  RefreshCwIcon,
  ServerIcon,
  Settings2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ApiState = "checking" | "connected" | "failed";

export default function HomePage() {
  const [apiState, setApiState] = useState<ApiState>("checking");
  const [apiMessage, setApiMessage] = useState("Contacting Django API");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function checkApiHealth() {
      setApiState("checking");
      setApiMessage("Contacting Django API");

      try {
        const response = await fetch("/api/health", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const payload = (await response.json()) as { status?: string };
        setApiState(payload.status === "ok" ? "connected" : "failed");
        setApiMessage(
          payload.status === "ok"
            ? "Django API responded with status ok"
            : "Django API responded with an unexpected payload",
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          setApiState("failed");
          setApiMessage(
            error instanceof Error ? error.message : "Unable to reach API",
          );
        }
      }
    }

    void checkApiHealth();

    return () => controller.abort();
  }, [refreshKey]);

  const isConnected = apiState === "connected";
  const progressValue = apiState === "checking" ? 42 : isConnected ? 100 : 16;

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-8 md:px-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-2xl flex-col gap-3">
            <Badge className="w-fit" variant="secondary">
              Django + Next.js 16 + shadcn/ui
            </Badge>
            <div className="flex flex-col gap-3">
              <h1 className="text-4xl font-semibold md:text-6xl">
                Full-stack mapping dashboard
              </h1>
              <p className="max-w-xl text-base text-muted-foreground md:text-lg">
                A connected demo page using local shadcn components and the
                existing Django Ninja health endpoint.
              </p>
            </div>
          </div>
          <Button onClick={() => setRefreshKey((key) => key + 1)}>
            <RefreshCwIcon data-icon="inline-start" />
            Check API
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <Card className="[--card-spacing:--spacing(6)]">
            <CardHeader>
              <CardTitle>Service status</CardTitle>
              <CardDescription>
                Frontend-to-backend connectivity through `/api/health`.
              </CardDescription>
              <CardAction>
                <Badge variant={isConnected ? "default" : "outline"}>
                  {apiState}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <StatusMetric
                  icon={ServerIcon}
                  label="Backend"
                  value={isConnected ? "Online" : "Pending"}
                />
                <StatusMetric
                  icon={ActivityIcon}
                  label="Endpoint"
                  value="/api/health"
                />
                <StatusMetric
                  icon={CheckCircle2Icon}
                  label="Payload"
                  value={isConnected ? "{ status: ok }" : "Waiting"}
                />
              </div>
              <Separator />
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Connection check</span>
                  <span className="text-sm text-muted-foreground">
                    {progressValue}%
                  </span>
                </div>
                <Progress value={progressValue} />
                <p className="text-sm text-muted-foreground">{apiMessage}</p>
              </div>
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                Served by Next.js, proxied to Django.
              </span>
              <Button
                nativeButton={false}
                render={
                  <a href="/api/health">
                    Open endpoint
                    <ExternalLinkIcon data-icon="inline-end" />
                  </a>
                }
                variant="outline"
              />
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Demo controls</CardTitle>
              <CardDescription>
                Components installed as editable project source.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="settings">
                <TabsList>
                  <TabsTrigger value="settings">
                    <Settings2Icon data-icon="inline-start" />
                    Settings
                  </TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                <TabsContent className="pt-5" value="settings">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="project-name">
                        Project name
                      </FieldLabel>
                      <Input
                        id="project-name"
                        readOnly
                        value="django-react-mapping"
                      />
                    </Field>
                    <Field
                      className="rounded-lg border p-4"
                      orientation="horizontal"
                    >
                      <FieldContent>
                        <FieldLabel htmlFor="proxy-mode">
                          Proxy API route
                        </FieldLabel>
                        <FieldDescription>
                          Use the existing `/api` route for Django.
                        </FieldDescription>
                      </FieldContent>
                      <Switch defaultChecked id="proxy-mode" />
                    </Field>
                  </FieldGroup>
                </TabsContent>
                <TabsContent className="pt-5" value="preview">
                  <div className="flex flex-col gap-4 rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">Stack readiness</span>
                      <Badge variant="secondary">Updated</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Next, React, Tailwind, and shadcn are installed from the
                      current npm registry versions.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

function StatusMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ServerIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-28 flex-col justify-between gap-4 rounded-lg border p-4">
      <Icon className="text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="truncate font-medium">{value}</span>
      </div>
    </div>
  );
}
