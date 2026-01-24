import { useState, useCallback, useEffect } from 'react';
import { Header } from '@/components/Header';
import { ChatPanel } from '@/components/ChatPanel';
import { EndpointReviewPanel } from '@/components/EndpointReviewPanel';
import { SpecPreviewPanel } from '@/components/SpecPreviewPanel';
import { ValidationPanel } from '@/components/ValidationPanel';
import { DocsPanel } from '@/components/DocsPanel';
import { MCPContextPanel } from '@/components/MCPContextPanel';
import { useChat } from '@/hooks/useChat';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, GitBranch, FileCode, Shield, BookOpen, Cpu } from 'lucide-react';
import { generateDocsFromSpec } from '@/lib/docs-generator';
import { APIDocumentation } from '@/types/docs';
import { editDocs } from '@/lib/api-client';

const Index = () => {
  const {
    messages,
    isLoading,
    proposedEndpoints,
    currentSpec,
    validationResult,
    mcpContext,
    isAutoFixing,
    sendMessage,
    approveEndpoint,
    rejectEndpoint,
    approveAllEndpoints,
    generateSpec
  } = useChat();

  const [docs, setDocs] = useState<APIDocumentation | null>(null);
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false);
  const [activeTab, setActiveTab] = useState('review');

  // Auto-generate docs when spec changes
  useEffect(() => {
    if (currentSpec) {
      setIsGeneratingDocs(true);
      // Simulate slight delay for better UX
      const timer = setTimeout(() => {
        const generatedDocs = generateDocsFromSpec(currentSpec);
        setDocs(generatedDocs);
        setIsGeneratingDocs(false);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setDocs(null);
    }
  }, [currentSpec]);

  const handleUpdateDocs = useCallback((updatedDocs: APIDocumentation) => {
    setDocs(updatedDocs);
  }, []);

  const handleAIEdit = useCallback(async (
    section: string,
    elementId: string | undefined,
    currentContent: string,
    prompt: string
  ): Promise<string> => {
    try {
      const result = await editDocs({
        section,
        element_id: elementId,
        current_content: currentContent,
        user_prompt: prompt,
      });
      return result.updated_content;
    } catch (error) {
      // Fallback: just return original content if AI fails
      console.error('AI edit failed:', error);
      throw error;
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 max-w-[1800px] w-full mx-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 h-[calc(100vh-7rem)]">
          {/* Chat Panel - Main interaction area */}
          <div className="lg:col-span-5 h-full min-h-[500px]">
            <ChatPanel
              messages={messages}
              isLoading={isLoading}
              onSendMessage={sendMessage}
            />
          </div>

          {/* Right Side Panels */}
          <div className="lg:col-span-7 h-full min-h-[500px]">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-6 bg-card border border-border rounded-xl p-1 h-auto">
                <TabsTrigger 
                  value="review"
                  className="data-[state=active]:bg-secondary rounded-lg py-2 text-xs"
                >
                  <GitBranch className="w-3.5 h-3.5 mr-1.5" />
                  Review
                  {proposedEndpoints.length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-primary/20 text-primary rounded text-[10px]">
                      {proposedEndpoints.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="spec"
                  className="data-[state=active]:bg-secondary rounded-lg py-2 text-xs"
                >
                  <FileCode className="w-3.5 h-3.5 mr-1.5" />
                  Spec
                  {currentSpec && (
                    <span className="ml-1.5 w-2 h-2 bg-success rounded-full" />
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="docs"
                  className="data-[state=active]:bg-secondary rounded-lg py-2 text-xs"
                >
                  <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                  Docs
                  {docs && (
                    <span className="ml-1.5 w-2 h-2 bg-success rounded-full" />
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="validate"
                  className="data-[state=active]:bg-secondary rounded-lg py-2 text-xs"
                >
                  <Shield className="w-3.5 h-3.5 mr-1.5" />
                  Validate
                </TabsTrigger>
                <TabsTrigger 
                  value="mcp"
                  className="data-[state=active]:bg-secondary rounded-lg py-2 text-xs"
                >
                  <Cpu className="w-3.5 h-3.5 mr-1.5" />
                  MCP
                  {isAutoFixing && (
                    <span className="ml-1.5 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="chat-mobile"
                  className="lg:hidden data-[state=active]:bg-secondary rounded-lg py-2 text-xs"
                >
                  <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                  Chat
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 mt-4 overflow-hidden">
                <TabsContent value="review" className="h-full m-0 rounded-xl border border-border bg-card overflow-hidden">
                  <EndpointReviewPanel
                    endpoints={proposedEndpoints}
                    onApprove={approveEndpoint}
                    onReject={rejectEndpoint}
                    onApproveAll={approveAllEndpoints}
                    onGenerateSpec={generateSpec}
                    isLoading={isLoading}
                  />
                </TabsContent>

                <TabsContent value="spec" className="h-full m-0 overflow-hidden">
                  <SpecPreviewPanel
                    spec={currentSpec}
                    validationResult={validationResult}
                  />
                </TabsContent>

                <TabsContent value="docs" className="h-full m-0 overflow-hidden">
                  <DocsPanel
                    docs={docs}
                    isLoading={isGeneratingDocs}
                    onUpdateDocs={handleUpdateDocs}
                    onAIEdit={handleAIEdit}
                  />
                </TabsContent>

                <TabsContent value="validate" className="h-full m-0 rounded-xl border border-border bg-card p-4 overflow-auto">
                  <ValidationPanel result={validationResult} />
                </TabsContent>

                <TabsContent value="mcp" className="h-full m-0 rounded-xl border border-border bg-card p-4 overflow-auto">
                  <MCPContextPanel context={mcpContext} isAutoFixing={isAutoFixing} />
                </TabsContent>

                <TabsContent value="chat-mobile" className="lg:hidden h-full m-0 overflow-hidden">
                  <ChatPanel
                    messages={messages}
                    isLoading={isLoading}
                    onSendMessage={sendMessage}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-3 px-4 text-center text-xs text-muted-foreground">
        API Forge • Powered by Ollama • Built for developers
      </footer>
    </div>
  );
};

export default Index;
