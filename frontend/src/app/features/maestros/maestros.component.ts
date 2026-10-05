import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

@Component({
	selector: "app-maestros",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterOutlet],
	templateUrl: "./maestros.component.html",
})
export class MaestrosComponent { }
