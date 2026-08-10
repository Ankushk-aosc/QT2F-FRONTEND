import React from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { CheckCircle } from "lucide-react"

interface SummaryHistoryProps {
  reportMessage: string;
  reportLink: string;
  folderName: string;
  workspaceName: string;
}

const SummaryHistory = ({ reportMessage, reportLink, folderName, workspaceName }: SummaryHistoryProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Generation Summary (History)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center mr-3">
            <CheckCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold">Report Status</h3>
            <p className="text-sm text-muted-foreground">
              {reportMessage}. The historical data is stored in the folder <strong>{folderName}</strong> which was deployed to the workspace <strong>{workspaceName}</strong>.
            </p>
            {reportLink && (
              <a
                href={reportLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm block mt-2"
              >
                View Historical Report in Microsoft Fabric
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default SummaryHistory