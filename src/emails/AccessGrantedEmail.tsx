import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";

export type AccessGrantedEmailProps = {
  learnerName: string;
  programName: string;
  loginUrl: string;
};

const BRAND_COLOR = "#3525cd";

export default function AccessGrantedEmail({ learnerName, programName, loginUrl }: AccessGrantedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your access to {programName} is now active</Preview>
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "Helvetica, Arial, sans-serif", padding: "24px 0" }}>
        <Container
          style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "32px", maxWidth: "480px" }}
        >
          <Text style={{ color: BRAND_COLOR, fontSize: "14px", fontWeight: 700, letterSpacing: "0.02em" }}>
            LumoraSpace
          </Text>
          <Heading style={{ fontSize: "20px", margin: "16px 0" }}>You&apos;re in, {learnerName}!</Heading>
          <Text style={{ fontSize: "15px", lineHeight: "22px", color: "#3f3f46" }}>
            Your access to <strong>{programName}</strong> has been granted. You can now sign in and start working
            through your lessons, assignments, and assessments.
          </Text>
          <Section style={{ marginTop: "24px" }}>
            <Button
              href={loginUrl}
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
              Go to LumoraSpace
            </Button>
          </Section>
          <Text style={{ fontSize: "13px", color: "#71717a", marginTop: "32px" }}>
            If you weren&apos;t expecting this, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
