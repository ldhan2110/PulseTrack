import { useRef, useState } from 'react';
import { Upload, Plus, X, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface ScopeData {
  features: string[];
  instructions: string;
  file: File | null;
}

interface WizardScopeStepProps {
  data: ScopeData;
  onChange: (data: ScopeData) => void;
}

export function WizardScopeStep({ data, onChange }: WizardScopeStepProps) {
  const [featureInput, setFeatureInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File | null) => {
    onChange({ ...data, file });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0] ?? null;
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    handleFileSelect(file);
  };

  const addFeature = () => {
    const trimmed = featureInput.trim();
    if (!trimmed) return;
    onChange({ ...data, features: [...data.features, trimmed] });
    setFeatureInput('');
  };

  const removeFeature = (index: number) => {
    onChange({ ...data, features: data.features.filter((_, i) => i !== index) });
  };

  const handleFeatureKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFeature();
    }
  };

  return (
    <div className="space-y-6">
      {/* File Dropzone */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Import Scope File (optional)</Label>
        {data.file ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate text-sm">{data.file.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => handleFileSelect(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">Drop file here or click to browse</p>
              <p className="text-xs text-muted-foreground">.xlsx, .xls, .csv supported</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>
        )}
      </div>

      {/* Features List */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Features</Label>
        <div className="space-y-2">
          {data.features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
              <span className="flex-1 text-sm">{feature}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => removeFeature(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            className="text-sm"
            placeholder="Add a feature..."
            value={featureInput}
            onChange={(e) => setFeatureInput(e.target.value)}
            onKeyDown={handleFeatureKeyDown}
          />
          <Button type="button" variant="outline" size="icon" onClick={addFeature}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Additional Instructions */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Additional Instructions</Label>
        <Textarea
          className="text-sm"
          placeholder="Any specific requirements, constraints, or notes for the AI..."
          rows={4}
          value={data.instructions}
          onChange={(e) => onChange({ ...data, instructions: e.target.value })}
        />
      </div>
    </div>
  );
}
