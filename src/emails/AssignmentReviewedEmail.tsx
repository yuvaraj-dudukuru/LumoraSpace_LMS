import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";

export type AssignmentReviewedOutcome = "APPROVED" | "REVISION_REQUESTED";

export type AssignmentReviewedEmailProps = {
  learnerName: string;
  assignmentTitle: string;
  outcome: AssignmentReviewedOutcome;
  reviewUrl: string;
};

const BRAND_COLOR = "#3525cd";

const OUTCOME_COPY: Record<AssignmentReviewedOutcome, { heading: string; body: string }> = {
  APPROVED: {
    heading: "Your submission was approved",
    body: "Nice work — your mentor has reviewed and approved your submission.",
  },
  REVISION_REQUESTED: {
    heading: "Revisions requested",
    body: "Your mentor has reviewed your submission and requested some changes before it can be approved.",
  },
};

export default function AssignmentReviewedEmail({
  learnerName,
  assignmentTitle,
  outcome,
  reviewUrl,
}: AssignmentReviewedEmailProps) {
  const copy = OUTCOME_COPY[outcome];

  return (
    <Html>
      <Head />
      <Preview>
        {assignmentTitle}: {copy.heading}
      </Preview>
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "Helvetica, Arial, sans-serif", padding: "24px 0" }}>
        <Container
          style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "32px", maxWidth: "480px" }}
        >
          <Text style={{ color: BRAND_COLOR, fontSize: "14px", fontWeight: 700, letterSpacing: "0.02em" }}>
            LumoraSpace
          </Text>
          <Heading style={{ fontSize: "20px", margin: "16px 0" }}>
            Hi {learnerName}, {copy.heading.toLowerCase()}
          </Heading>
          <Text style={{ fontSize: "15px", lineHeight: "22px", color: "#3f3f46" }}>
            <strong>{assignmentTitle}</strong>: {copy.body}
          </Text>
          <Section style={{ marginTop: "24px" }}>
            <Button
              href={reviewUrl}
              style={{
                backgroundColor: BRAND_COLOR,
                color: "#ffffff",
                borderRadius: "8px",
                padding: "12px 20px",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              View Feedback
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
