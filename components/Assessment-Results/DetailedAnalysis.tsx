import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { MappedAssessmentData } from './types';
import ScreenshotTable from './ScreenshotTable';

interface DetailedAnalysisProps {
  assessmentData: MappedAssessmentData;
}

const DetailedAnalysis: React.FC<DetailedAnalysisProps> = ({ assessmentData }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detailed Assessment Analysis</CardTitle>
        <CardDescription>In-depth analysis of each assessment category</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="powerbi">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Badge variant="default">{assessmentData.powerbi_replicability.recommendation}</Badge>
                <span>Power BI Replicability</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 pl-6 list-disc">
                {assessmentData.assessments.powerbi.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="documentation">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Badge variant="default">{assessmentData.documentation_quality}</Badge>
                <span>Documentation Quality</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 pl-6 list-disc">
                {assessmentData.assessments.documentation.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="dimensional">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Badge variant="default">{assessmentData.dimensional_model}</Badge>
                <span>Dimensional Model</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 pl-6 list-disc">
                {assessmentData.assessments.dimensional.length > 0 && (
                  <li>{assessmentData.assessments.dimensional[assessmentData.assessments.dimensional.length - 1]}</li>
                )}
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="data-model">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Badge variant="default">Model Structure</Badge>
                <span>Data Model</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pl-6">
                <div>
                  <h4 className="font-medium">Details</h4>
                  <ul className="space-y-2 list-disc pl-5">
                    {assessmentData.assessments.data_model.length > 0 && (
                      <li>{assessmentData.assessments.data_model[0]}</li>
                    )}
                  </ul>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sensitivity">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Badge variant="default">{assessmentData.data_sensitivity}</Badge>
                <span>Data Sensitivity</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 pl-6 list-disc">
                {assessmentData.assessments.sensitivity.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="screenshots">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Badge variant="default">Insights</Badge>
                <span>Screenshots</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 pl-6 list-disc">
                {assessmentData.assessments.screenshots.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <ScreenshotTable screenshots={assessmentData.screenshots} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default DetailedAnalysis;