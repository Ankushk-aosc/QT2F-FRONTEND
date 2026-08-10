import React from 'react';

interface ScreenshotItem {
  title?: string;
  visualization_type?: string;
  story?: string;
  creation_date?: string;
  annotation?: string;
  position?: string | { width: string; height: string; top: string; left: string; 'z-index'?: number; right?: string };
}

interface ScreenshotTableProps {
  screenshots: string;
}

const ScreenshotTable: React.FC<ScreenshotTableProps> = ({ screenshots }) => {
  const parseScreenshots = (): ScreenshotItem[] => {
    try {
      const screenshotData = JSON.parse(screenshots.replace(/'/g, '"'));
      return Array.isArray(screenshotData) ? screenshotData : [];
    } catch (e) {
      console.error("Error parsing screenshots:", e);
      return [];
    }
  };

  const screenshotItems = parseScreenshots();

  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted">
            <th className="py-2 px-4 text-left">Title</th>
            <th className="py-2 px-4 text-left">Visualization Type</th>
            <th className="py-2 px-4 text-left">Story</th>
            <th className="py-2 px-4 text-left">Creation Date</th>
            <th className="py-2 px-4 text-left">Annotation</th>
            <th className="py-2 px-4 text-left">Position</th>
          </tr>
        </thead>
        <tbody>
          {screenshotItems.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-2 px-4 text-center text-gray-500">
                No screenshots available
              </td>
            </tr>
          ) : (
            screenshotItems.map((item: ScreenshotItem, index: number) => (
              <tr key={index} className="border-b">
                <td className="py-2 px-4">{item.title || "Untitled"}</td>
                <td className="py-2 px-4">{item.visualization_type || "Unknown"}</td>
                <td className="py-2 px-4">{item.story || "Unknown"}</td>
                <td className="py-2 px-4">
                  {item.creation_date ? new Date(item.creation_date).toLocaleString() : "Unknown"}
                </td>
                <td className="py-2 px-4">{item.annotation || "No annotation"}</td>
                <td className="py-2 px-4">
                  {item.position
                    ? typeof item.position === "string"
                      ? item.position
                      : `${item.position.width} x ${item.position.height} at ${item.position.left}, ${item.position.top}`
                    : "Unknown"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ScreenshotTable;