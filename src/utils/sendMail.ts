export interface IMailOption {
    host: string;
    port?: number;
    secureConnection?: boolean;
    auth: {
        user: string,
        pass: string,
    };
}

class MailSender {

    protected _nodeMailer: any;

    protected get nodeMailer() {
        if (!require) {
            throw new Error("Cannot load nodemailer. Try to install all required dependencies.");
        }
        if (!this._nodeMailer) {
            try {
                this._nodeMailer = require("nodemailer");
            } catch (e) {
                throw new Error("nodemailer package was not found installed. Try to install it: npm install nodemailer --save");
            }
        }
        return this._nodeMailer;
    }

    public async sendMail(
        from_name: string,
        from_email: string,
        to_email: string,
        subject: string,
        content: string,
        option: IMailOption) {
        let message = {
            to: to_email,
            subject: subject,
            text: content
        };

        const transporter = this.nodeMailer.createTransport(option, {
            from: `"${from_name}" <${from_email}>`,
        });

        return await transporter.sendMail(message);
    }
}


export const mail = new MailSender();
