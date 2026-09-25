mod compact;
mod handlers;
mod server;

use rmcp::transport::stdio;
use rmcp::ServiceExt;
use server::AiChatsMcp;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .with_ansi(false)
        .init();

    let service = AiChatsMcp::from_env()
        .serve(stdio())
        .await
        .inspect_err(|e| tracing::error!("serve failed: {e:?}"))?;
    service.waiting().await?;
    Ok(())
}
