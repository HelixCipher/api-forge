import { Zap, Github, FileCode2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SystemStatusIndicator } from './SystemStatusIndicator';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function Header() {
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  const examples = [
    {
      title: "Employee Management API",
      description: "Design an API for managing employee records with CRUD operations",
      query: "I want an API to manage employee records with create, read, update, and delete operations"
    },
    {
      title: "E-commerce Product API",
      description: "Build an API for product catalog management",
      query: "Create an API for an e-commerce product catalog with categories, inventory, and pricing"
    },
    {
      title: "Task Management API",
      description: "Task tracking system with assignments and status updates",
      query: "I need an API for a task management system with assignments, due dates, and status tracking"
    },
    {
      title: "User Authentication API",
      description: "Secure authentication system with JWT tokens",
      query: "Build a user authentication API with login, registration, password reset, and JWT token management"
    },
    {
      title: "Blog Platform API",
      description: "Content management system for blogs with comments",
      query: "Create a blog platform API with posts, comments, categories, tags, and user management"
    },
    {
      title: "Weather API",
      description: "Weather data service with forecasts and locations",
      query: "Design a weather API that provides current conditions, forecasts, and location search capabilities"
    },
    {
      title: "Social Media API",
      description: "Social networking features with posts and interactions",
      query: "Build a social media API with user profiles, posts, likes, comments, and follower relationships"
    },
    {
      title: "Inventory Management API",
      description: "Stock tracking and warehouse management system",
      query: "Create an inventory management API with product tracking, stock levels, suppliers, and order management"
    },
    {
      title: "Booking System API",
      description: "Reservation system for appointments and services",
      query: "Design a booking API for scheduling appointments with availability, time slots, and confirmation management"
    },
    {
      title: "File Upload API",
      description: "Cloud storage service with file management",
      query: "Build a file upload API with multi-format support, size limits, folder organization, and sharing capabilities"
    },
    {
      title: "Payment Processing API",
      description: "Financial transaction system with secure payments",
      query: "Create a payment processing API with credit card support, refunds, transaction history, and webhook notifications"
    },
    {
      title: "Healthcare Records API",
      description: "Medical records management with HIPAA compliance",
      query: "Design a healthcare API for patient records, appointments, prescriptions, and doctor-patient interactions"
    },
    {
      title: "IoT Device Management API",
      description: "Smart device monitoring and control system",
      query: "Build an IoT API for device registration, real-time monitoring, firmware updates, and data analytics"
    },
    {
      title: "Educational Platform API",
      description: "Learning management system with courses and assessments",
      query: "Create an educational API with courses, lessons, assignments, grades, and student progress tracking"
    },
    {
      title: "Restaurant Ordering API",
      description: "Food delivery and restaurant management system",
      query: "Design a restaurant API with menu management, order processing, delivery tracking, and customer reviews"
    },
    {
      title: "Flight Booking API",
      description: "Airline reservation system with search and booking",
      query: "Build a flight booking API with flight search, seat selection, booking management, and check-in features"
    },
    {
      title: "Music Streaming API",
      description: "Audio streaming service with playlists and recommendations",
      query: "Create a music API with track streaming, playlist management, user preferences, and recommendation engine"
    }
  ];

  return (
    <>
      <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="h-full max-w-[1800px] mx-auto px-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">
                API <span className="text-gradient-primary">Forge</span>
              </h1>
              <p className="text-[10px] text-muted-foreground">OpenAPI Generator</p>
            </div>
          </div>

          {/* System Status */}
          <div className="flex items-center gap-4">
            <SystemStatusIndicator />

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground"
                onClick={() => setExamplesOpen(true)}
              >
                <FileCode2 className="w-4 h-4 mr-2" />
                Examples
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground"
                onClick={() => setDocsOpen(true)}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Docs
              </Button>
            </nav>

            {/* Actions */}
            <Button variant="outline" size="sm" asChild>
              <a href="https://github.com/HelixCipher/api-forge" target="_blank" rel="noopener noreferrer">
                <Github className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">GitHub</span>
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* Examples Dialog */}
      <Dialog open={examplesOpen} onOpenChange={setExamplesOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Example Queries</DialogTitle>
            <DialogDescription>
              Try these example queries to get started with API Forge
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-2">
            {examples.map((example, index) => (
              <div 
                key={index}
                className="p-4 border border-border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => {
                  // You can dispatch an event or use a context to set the input
                  window.dispatchEvent(new CustomEvent('useExample', { detail: example.query }));
                  setExamplesOpen(false);
                }}
              >
                <h3 className="font-semibold mb-1">{example.title}</h3>
                <p className="text-sm text-muted-foreground mb-2">{example.description}</p>
                <code className="text-xs bg-muted px-2 py-1 rounded break-all">{example.query}</code>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Docs Dialog */}
      <Dialog open={docsOpen} onOpenChange={setDocsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>API Forge Documentation</DialogTitle>
            <DialogDescription>
              Quick guide to using API Forge
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <section>
              <h3 className="text-lg font-semibold mb-2">How It Works</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Describe your API in natural language</li>
                <li>Review and approve proposed endpoints</li>
                <li>Generate validated OpenAPI specifications</li>
                <li>Download in YAML or JSON format</li>
              </ol>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2">Features</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Local AI models (via Ollama)</li>
                <li>Human-in-the-loop validation</li>
                <li>Automatic spec validation and fixing</li>
                <li>REST best practices enforcement</li>
                <li>Multi-agent architecture</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2">Tips</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Be specific about your API requirements</li>
                <li>Review each endpoint before approval</li>
                <li>The system will auto-validate and iterate until specs are 100% valid</li>
                <li>You can remove unwanted endpoints before generation</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2">System Requirements</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Ollama running locally with llama3.2 model</li>
                <li>Docker</li>
              </ul>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}