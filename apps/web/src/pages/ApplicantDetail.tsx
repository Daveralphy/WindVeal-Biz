import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Linkedin,
  Briefcase,
  ExternalLink,
  FileText,
  Video,
  Calendar,
} from 'lucide-react';
import api from '@/lib/api';


// â”€â”€ Types â”€â”€

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
}

interface ApplicationFormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  system?: boolean;
}

interface ApplicationDataItem {
  id: string;
  fieldId: string;
  value: unknown;
}

interface UploadedFileItem {
  id: string;
  type: string;
  fileName: string;
  storageUrl: string;
  mimeType?: string;
}

interface StageHistoryItem {
  id: string;
  fromStage?: { name: string; color: string } | null;
  toStage: { name: string; color: string; id?: string };
  movedBy?: { firstName: string; lastName: string } | null;
  movedAt: string;
  note?: string;
}

interface ApplicantDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  source: string;
  qualified: boolean | null;
  createdAt: string;
  job: {
    id: string;
    title: string;
    aiKeywords?: string[];
    applicationForm?: { fields: ApplicationFormField[] } | null;
    pipelineStages: PipelineStage[];
  };
  currentStage: PipelineStage;
  applicationData: ApplicationDataItem[];
  uploadedFiles: UploadedFileItem[];
  stageHistory: StageHistoryItem[];
}

// â”€â”€ Constants â”€â”€

const SOURCE_LABELS: Record<string, string> = {
  PORTAL: 'Careers Page',
  MANUAL: 'Manual',
  IMPORTED: 'Imported',
  REFERRAL: 'Referral',
};



// â”€â”€ Component â”€â”€

export default function ApplicantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<ApplicantDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/applicants/${id}`)
      .then((res) => setDetail(res.data))
      .catch(() => navigate('/applicants'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const getFieldValue = (fieldId: string): string => {
    if (!detail) return '';
    const data = detail.applicationData.find((d) => d.fieldId === fieldId);
    if (!data) return '';
    const val = data.value;
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val !== null && 'value' in (val as Record<string, unknown>)) {
      return String((val as Record<string, unknown>).value);
    }
    return String(val ?? '');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-vb-muted rounded animate-pulse" />
          <div className="h-6 w-48 bg-vb-muted rounded animate-pulse" />
        </div>
        <div className="h-40 bg-vb-muted rounded-xl animate-pulse" />
        <div className="h-60 bg-vb-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!detail) return null;

  const pipelineStages = detail.job.pipelineStages;
  const currentStageIdx = pipelineStages.findIndex((s) => s.id === detail.currentStage.id);

  // Build date map for stage timeline — handles reverts by clearing future-stage dates
  const stageOrderById: Record<string, number> = {};
  pipelineStages.forEach((s) => { stageOrderById[s.id] = s.order; });

  const stageDateMap: Record<string, string> = {};
  const firstStage = pipelineStages[0];
  if (firstStage) stageDateMap[firstStage.id] = detail.createdAt;
  [...detail.stageHistory]
    .sort((a, b) => new Date(a.movedAt).getTime() - new Date(b.movedAt).getTime())
    .forEach((entry) => {
      const toId = entry.toStage.id || '';
      if (!toId) return;
      const toOrder = stageOrderById[toId] ?? Infinity;
      // On revert: clear dates for all stages that come after the new position
      Object.keys(stageDateMap).forEach((sid) => {
        if ((stageOrderById[sid] ?? -1) > toOrder) {
          delete stageDateMap[sid];
        }
      });
      stageDateMap[toId] = entry.movedAt;
    });

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => navigate('/applicants')}
            className="p-2 text-vb-text-muted hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
            <User className="w-6 h-6 text-brand" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-vb-text truncate">
              {detail.firstName} {detail.lastName}
            </h1>
            <div className="mt-1 space-y-0.5">
              <div className="flex items-center gap-1.5 text-sm text-vb-text-muted">
                <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
                {detail.job.title}
              </div>
              <div className="flex items-center gap-x-3 text-xs text-vb-text-muted">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  Applied {new Date(detail.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-vb-border">·</span>
                <span>{SOURCE_LABELS[detail.source] || detail.source}</span>
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate(`/jobs/${detail.job.id}/applicants/${detail.id}`)}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors flex-shrink-0"
        >
          View Application
        </button>
      </div>

      {/* ── Horizontal Pipeline ── */}
      <div className="bg-vb-card border border-vb-border rounded-xl p-5 overflow-x-auto">
        <div className="flex items-start min-w-max">
          {pipelineStages.map((stage, i) => {
            const isReached = i <= currentStageIdx;
            const isCurrent = i === currentStageIdx;
            const isLast = i === pipelineStages.length - 1;
            const dateStr = stageDateMap[stage.id];
            return (
              <React.Fragment key={stage.id}>
                <div className="flex flex-col items-center w-24 text-center">
                  <div
                    className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mb-1.5 ${
                      !isReached ? 'border-vb-border bg-vb-muted' : ''
                    } ${isCurrent ? 'ring-2 ring-offset-2 ring-offset-vb-card' : ''}`}
                    style={isReached
                      ? {
                          borderColor: stage.color,
                          backgroundColor: isCurrent ? stage.color : `${stage.color}40`,
                          ...(isCurrent ? { ringColor: stage.color } : {}),
                        }
                      : {}}
                  />
                  <p className={`text-[11px] font-medium leading-tight px-1 ${
                    isCurrent ? 'text-vb-text' : isReached ? 'text-vb-text-secondary' : 'text-vb-text-faint'
                  }`}>
                    {stage.name}
                  </p>
                  {isCurrent && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand/10 text-brand mt-1">
                      Current
                    </span>
                  )}
                  {!isCurrent && dateStr && (
                    <p className="text-[10px] text-vb-text-muted mt-0.5">
                      {new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                  {!isCurrent && !dateStr && (
                    <p className="text-[10px] text-vb-text-faint mt-0.5">—</p>
                  )}
                </div>
                {!isLast && (
                  <div className="flex items-center w-8 flex-shrink-0 mt-1.5">
                    <div
                      className={`h-0.5 w-full ${i < currentStageIdx ? '' : 'bg-vb-border'}`}
                      style={i < currentStageIdx ? { backgroundColor: `${stage.color}60` } : {}}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── LEFT COLUMN (2/3) ─── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <section className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-vb-text">Contact Information</h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-vb-text-muted flex-shrink-0" />
                <a href={`mailto:${detail.email}`} className="text-brand hover:underline">{detail.email}</a>
              </div>
              {detail.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-vb-text-muted flex-shrink-0" />
                  <span className="text-vb-text">{detail.phone}</span>
                </div>
              )}
              {detail.linkedinUrl && (
                <div className="flex items-center gap-3 text-sm">
                  <Linkedin className="w-4 h-4 text-vb-text-muted flex-shrink-0" />
                  <a href={detail.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline flex items-center gap-1">
                    LinkedIn Profile <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </section>

          {/* Application Responses */}
          {(detail.applicationData.length > 0 || detail.uploadedFiles.length > 0) && (
            <section className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-medium text-vb-text">Application Responses</h3>
              <div className="divide-y divide-vb-border">
                {detail.job.applicationForm?.fields
                  ?.filter((f) => !f.system)
                  .map((field) => {
                    if (field.type === 'file') {
                      const uploadedFile = detail.uploadedFiles.find((f) => f.type === field.id);
                      if (!uploadedFile && !field.required) return null;
                      return (
                        <div key={field.id} className="py-3 first:pt-0 last:pb-0">
                          <p className="text-xs text-vb-text-muted flex items-center gap-1 mb-1">
                            {field.label}
                            {field.required && <span className="text-red-400">*</span>}
                          </p>
                          {!uploadedFile ? (
                            <p className="text-sm text-vb-text-faint italic">Not provided</p>
                          ) : (
                            <a
                              href={`/api/uploads/${uploadedFile.storageUrl.replace(/.*[/\\]/, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 bg-vb-surface border border-vb-border rounded-lg px-4 py-3 hover:opacity-80 transition-opacity"
                            >
                              {uploadedFile.mimeType?.startsWith('video/') ? (
                                <Video className="w-5 h-5 text-brand flex-shrink-0" />
                              ) : (
                                <FileText className="w-5 h-5 text-brand flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-vb-text truncate">{uploadedFile.fileName}</p>
                              </div>
                              <ExternalLink className="w-4 h-4 text-vb-text-muted" />
                            </a>
                          )}
                        </div>
                      );
                    }

                    const value = getFieldValue(field.id);
                    if (!value && !field.required) return null;
                    return (
                      <div key={field.id} className="py-3 first:pt-0 last:pb-0">
                        <p className="text-xs text-vb-text-muted flex items-center gap-1 mb-1">
                          {field.label}
                          {field.required && <span className="text-red-400">*</span>}
                        </p>
                        {!value ? (
                          <p className="text-sm text-vb-text-faint italic">Not provided</p>
                        ) : field.type === 'long_text' ? (
                          <p className="text-sm text-vb-text whitespace-pre-wrap">{value}</p>
                        ) : field.type === 'url' ? (
                          <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-brand hover:underline flex items-center gap-1">
                            {value} <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <p className="text-sm text-vb-text">{value}</p>
                        )}
                      </div>
                    );
                  })}
                {detail.applicationData
                  .filter((d) => {
                    const formFieldIds = detail.job.applicationForm?.fields?.map((f) => f.id) || [];
                    return !formFieldIds.includes(d.fieldId) && d.fieldId !== 'cover_letter';
                  })
                  .map((d) => {
                    const label = d.fieldId.startsWith('custom_')
                      ? d.fieldId.replace('custom_', '').replace(/_/g, ' ')
                      : d.fieldId;
                    const val = typeof d.value === 'string' ? d.value : String(d.value ?? '');
                    if (!val) return null;
                    return (
                      <div key={d.id} className="py-3 first:pt-0 last:pb-0">
                        <p className="text-xs text-vb-text-muted capitalize mb-1">{label}</p>
                        <p className="text-sm text-vb-text">{val}</p>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}
        </div>

        {/* ─── RIGHT COLUMN (1/3) ─── */}
        <div className="space-y-6">
          {/* Uploaded Files */}
          {detail.uploadedFiles.filter((f) => {
            const formFieldIds = detail.job.applicationForm?.fields
              ?.filter((ff) => ff.type === 'file')
              .map((ff) => ff.id) || [];
            return !formFieldIds.includes(f.type);
          }).length > 0 && (
            <section className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-medium text-vb-text">Submitted Files</h3>
              <div className="space-y-2">
                {detail.uploadedFiles.map((file) => (
                  <a
                    key={file.id}
                    href={`/api/uploads/${file.storageUrl.replace(/.*[/\\]/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-vb-surface border border-vb-border rounded-lg px-4 py-3 hover:opacity-80 transition-opacity"
                  >
                    {file.mimeType?.startsWith('video/') ? (
                      <Video className="w-5 h-5 text-brand flex-shrink-0" />
                    ) : (
                      <FileText className="w-5 h-5 text-brand flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-vb-text truncate">{file.fileName}</p>
                      <p className="text-xs text-vb-text-muted capitalize">{file.type.replace('_', ' ')}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-vb-text-muted" />
                  </a>
                ))}
              </div>
            </section>
          )}


        </div>
      </div>
    </div>
  );
}

