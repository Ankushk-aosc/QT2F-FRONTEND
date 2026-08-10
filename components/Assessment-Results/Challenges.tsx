import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { MappedAssessmentData } from './types';

interface ChallengesProps {
  assessmentData: MappedAssessmentData;
}

const Challenges: React.FC<ChallengesProps> = ({ assessmentData }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detailed Assessment Challenges</CardTitle>
        <CardDescription>In-depth analysis of each assessment category</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-4">Challenges</h3>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="migration-challenges">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{assessmentData.migration_challenges}</Badge>
                    <span>Migration Challenges</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 pl-6 list-disc">
                    {assessmentData.assessments.migration_challenges.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="unsupported-data-types">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{assessmentData.unsupported_data_types}</Badge>
                    <span>Unsupported Data Types</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 pl-6 list-disc">
                    {assessmentData.assessments.unsupported_data_types.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="query-complexity">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{assessmentData.query_complexity}</Badge>
                    <span>Query Complexity</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 pl-6 list-disc">
                    {assessmentData.assessments.query_complexity.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="data-volume">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{assessmentData.data_volume}</Badge>
                    <span>Data Volume</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 pl-6 list-disc">
                    {assessmentData.assessments.data_volume.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Challenges;