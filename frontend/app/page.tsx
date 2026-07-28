"use client";

import {
  ArrowRightIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import type { Project } from "@/lib/types";

export default function ProjectDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [projectName, setProjectName] = useState("Untitled Mapping");
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  useEffect(() => {
    apiRequest<Project[]>("/projects")
      .then(setProjects)
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : "Could not load projects.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  async function createProject() {
    setCreating(true);
    try {
      const project = await apiRequest<Project>("/projects", {
        method: "POST",
        body: JSON.stringify({ name: projectName }),
      });
      window.location.assign(`/projects/${project.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create project.",
      );
      setCreating(false);
    }
  }

  async function deleteProject() {
    if (!deleteTarget) {
      return;
    }
    try {
      await apiRequest<void>(`/projects/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setProjects((items) =>
        items.filter((project) => project.id !== deleteTarget.id),
      );
      toast.success("Project deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete project.",
      );
    } finally {
      setDeleteTarget(null);
    }
  }

  async function seedProject(seedId: string, projectName: string) {
    setSeeding(seedId);
    try {
      const project = await apiRequest<Project>(`/projects/seeds/${seedId}`, {
        method: "POST",
      });
      setProjects((items) => {
        const existingIndex = items.findIndex((item) => item.id === project.id);
        if (existingIndex === -1) {
          return [project, ...items];
        }
        return items.map((item) => (item.id === project.id ? project : item));
      });
      toast.success(`${projectName} is ready.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Could not seed ${projectName}.`,
      );
    } finally {
      setSeeding(null);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 md:px-10 md:py-12">
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <h1 className="text-2xl font-semibold">Projects</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setCreateOpen(true)} size="sm">
                <PlusIcon data-icon="inline-start" />
                New project
              </Button>
              <Button
                disabled={seeding !== null}
                onClick={() =>
                  void seedProject("neon-cathedral", "Neon Cathedral Demo")
                }
                size="sm"
                variant="outline"
              >
                <RefreshCwIcon data-icon="inline-start" />
                Seed / restore Neon demo
              </Button>
              <Button
                disabled={seeding !== null}
                onClick={() =>
                  void seedProject("bolshoi-theatre", "Bolshoi Theatre")
                }
                size="sm"
                variant="outline"
              >
                <RefreshCwIcon data-icon="inline-start" />
                Seed / restore Bolshoi
              </Button>
              <Badge variant="outline">
                {projects.length}{" "}
                {projects.length === 1 ? "project" : "projects"}
              </Badge>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {loading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton className="h-56 rounded-xl" key={index} />
                ))
              : projects.map((project) => (
                  <Card key={project.id}>
                    <CardHeader>
                      <CardTitle>{project.name}</CardTitle>
                      <CardDescription>
                        {project.duration}s · {project.frameRate} fps ·{" "}
                        {project.stageWidth} × {project.stageDepth}m
                      </CardDescription>
                      <CardAction>
                        <Button
                          aria-label={`Delete ${project.name}`}
                          onClick={() => setDeleteTarget(project)}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <Trash2Icon />
                        </Button>
                      </CardAction>
                    </CardHeader>
                    <CardContent>
                      <div className="flex h-24 items-end rounded-lg bg-muted p-3">
                        <div className="flex items-end gap-2">
                          <span className="h-10 w-14 rounded-sm bg-primary/25" />
                          <span className="h-16 w-8 rounded-sm bg-primary/45" />
                          <span className="h-8 w-16 rounded-sm bg-primary/20" />
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="justify-between">
                      <span className="text-xs text-muted-foreground">
                        Updated{" "}
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                      <Button
                        nativeButton={false}
                        render={<Link href={`/projects/${project.id}`} />}
                        variant="outline"
                      >
                        Open studio
                        <ArrowRightIcon data-icon="inline-end" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
          </div>
        </section>
      </section>

      <Dialog onOpenChange={setCreateOpen} open={createOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create mapping project</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="project-name">Project name</FieldLabel>
              <Input
                autoFocus
                id="project-name"
                onChange={(event) => setProjectName(event.target.value)}
                value={projectName}
              />
              <FieldDescription>
                You can rename it later in project settings.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button onClick={() => setCreateOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button
              disabled={creating || !projectName.trim()}
              onClick={() => void createProject()}
            >
              Create project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        open={deleteTarget !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the scene, timelines, and uploaded
              assets for this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void deleteProject()}
              variant="destructive"
            >
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
